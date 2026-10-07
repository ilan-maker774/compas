/**
 * Rejoue l'historique des transactions et valorise le portefeuille à une date donnée.
 *
 * Règles (documentées dans docs/03-calculs.md) :
 * - Prix de revient : moyen pondéré, frais et taxes d'achat inclus, en euros au taux de
 *   change de chaque achat, calculé par compte et par instrument.
 * - Une vente réalise (produit net − PRU × quantité) et ne modifie pas le PRU restant.
 * - Comptes « avec suivi des espèces » : ceux qui contiennent au moins un versement ou
 *   un retrait. Leur valeur inclut les liquidités et seuls versements/retraits sont des flux
 *   externes. Sur les autres comptes, chaque achat est un apport et chaque vente, dividende
 *   ou intérêt versé est un retrait.
 * - Intérêts capitalisés (fonds euros : intérêts avec quantité) : ajoutent des parts,
 *   augmentent le coût de revient et comptent comme revenus, sans mouvement d'espèces.
 */
import { Decimal, FxTable, ZERO, dec, lastPrice } from "./series";
import type { InstrumentInput, PortfolioData, TransactionType, TxInput } from "./types";

const TYPE_ORDER: Record<TransactionType, number> = {
  versement: 0,
  achat: 1,
  vente: 2,
  dividende: 3,
  interets: 4,
  frais: 5,
  taxe: 6,
  retrait: 7,
};

export function sortTransactions(txs: TxInput[]): TxInput[] {
  return [...txs].sort(
    (a, b) => a.tradeDate.localeCompare(b.tradeDate) || TYPE_ORDER[a.type] - TYPE_ORDER[b.type],
  );
}

export type Holding = {
  accountId: string;
  instrumentId: string;
  quantity: Decimal;
  /** Coût de revient total des titres encore détenus, en euros. */
  costEur: Decimal;
  /** Dernier prix de transaction (repli si aucun cours n'est disponible). */
  lastTradePrice: Decimal;
  lastTradeDate: string;
};

export type ExternalFlow = { date: string; accountId: string; amountEur: Decimal };

export type LedgerWarning = { txId: string; message: string };

export class Ledger {
  readonly holdings = new Map<string, Holding>();
  readonly cash = new Map<string, Decimal>();
  readonly flows: ExternalFlow[] = [];
  readonly warnings: LedgerWarning[] = [];
  realizedEur = ZERO;
  incomeEur = ZERO;
  feesEur = ZERO;
  taxesEur = ZERO;

  private readonly cashTracked: Set<string>;
  private readonly instruments: Map<string, InstrumentInput>;

  constructor(
    data: Pick<PortfolioData, "instruments" | "transactions">,
    private readonly fx: FxTable,
  ) {
    this.instruments = new Map(data.instruments.map((i) => [i.id, i]));
    this.cashTracked = new Set(
      data.transactions
        .filter((t) => t.type === "versement" || t.type === "retrait")
        .map((t) => t.accountId),
    );
  }

  isCashTracked(accountId: string) {
    return this.cashTracked.has(accountId);
  }

  apply(tx: TxInput) {
    const eur = (v: Decimal) => this.fx.toEur(v, tx.currency, tx.tradeDate, tx.fxRateToEur);
    const fees = eur(dec(tx.fees));
    const taxes = eur(dec(tx.taxes));
    this.feesEur = this.feesEur.plus(fees);
    this.taxesEur = this.taxesEur.plus(taxes);

    let cashEffect = ZERO;
    switch (tx.type) {
      case "achat": {
        const h = this.holding(tx);
        const qty = dec(tx.quantity);
        const cost = eur(qty.mul(dec(tx.unitPrice)))
          .plus(fees)
          .plus(taxes);
        h.quantity = h.quantity.plus(qty);
        h.costEur = h.costEur.plus(cost);
        h.lastTradePrice = dec(tx.unitPrice);
        h.lastTradeDate = tx.tradeDate;
        cashEffect = cost.neg();
        break;
      }
      case "vente": {
        const h = this.holding(tx);
        let qty = dec(tx.quantity);
        if (qty.gt(h.quantity)) {
          this.warnings.push({
            txId: tx.id,
            message: `Vente de ${qty} titres alors que ${h.quantity} sont détenus au ${tx.tradeDate}`,
          });
          qty = h.quantity;
        }
        const proceeds = eur(dec(tx.quantity).mul(dec(tx.unitPrice)))
          .minus(fees)
          .minus(taxes);
        const avgCost = h.quantity.isZero() ? ZERO : h.costEur.div(h.quantity);
        const costSold = avgCost.mul(qty);
        this.realizedEur = this.realizedEur.plus(proceeds.minus(costSold));
        h.quantity = h.quantity.minus(qty);
        h.costEur = h.quantity.isZero() ? ZERO : h.costEur.minus(costSold);
        h.lastTradePrice = dec(tx.unitPrice);
        h.lastTradeDate = tx.tradeDate;
        cashEffect = proceeds;
        break;
      }
      case "dividende":
      case "interets": {
        const net = eur(dec(tx.amount)).minus(fees).minus(taxes);
        this.incomeEur = this.incomeEur.plus(net);
        if (tx.quantity && tx.instrumentId) {
          // Intérêts capitalisés : de nouvelles parts, sans espèces.
          const h = this.holding(tx);
          h.quantity = h.quantity.plus(dec(tx.quantity));
          h.costEur = h.costEur.plus(net);
          return;
        }
        cashEffect = net;
        break;
      }
      case "frais":
      case "taxe": {
        const amount = eur(dec(tx.amount));
        if (tx.type === "frais") this.feesEur = this.feesEur.plus(amount);
        else this.taxesEur = this.taxesEur.plus(amount);
        cashEffect = amount.plus(fees).plus(taxes).neg();
        break;
      }
      case "versement": {
        const amount = eur(dec(tx.amount));
        this.addCash(tx.accountId, amount.minus(fees).minus(taxes));
        this.flows.push({ date: tx.tradeDate, accountId: tx.accountId, amountEur: amount });
        return;
      }
      case "retrait": {
        const amount = eur(dec(tx.amount));
        this.addCash(tx.accountId, amount.plus(fees).plus(taxes).neg());
        this.flows.push({ date: tx.tradeDate, accountId: tx.accountId, amountEur: amount.neg() });
        return;
      }
    }

    if (this.cashTracked.has(tx.accountId)) {
      this.addCash(tx.accountId, cashEffect);
    } else if (!cashEffect.isZero()) {
      this.flows.push({ date: tx.tradeDate, accountId: tx.accountId, amountEur: cashEffect.neg() });
    }
  }

  /** Valorisation détaillée à une date (les transactions jusqu'à cette date doivent être appliquées). */
  valuation(date: string, prices: PortfolioData["prices"]) {
    const lines: HoldingValuation[] = [];
    let total = ZERO;
    for (const h of this.holdings.values()) {
      if (h.quantity.isZero()) continue;
      const instrument = this.instruments.get(h.instrumentId)!;
      const priced = priceOf(instrument, h, date, prices);
      const fx = this.fx.rate(instrument.currency, date);
      const valueEur = h.quantity.mul(priced.price).div(fx.rate);
      total = total.plus(valueEur);
      lines.push({
        ...h,
        instrument,
        price: priced.price,
        priceDate: priced.date,
        priceSource: priced.source,
        fxRate: fx.rate,
        fxDate: fx.date,
        valueEur,
        unrealizedEur: valueEur.minus(h.costEur),
      });
    }
    let cashTotal = ZERO;
    for (const [accountId, amount] of this.cash) {
      if (this.cashTracked.has(accountId)) cashTotal = cashTotal.plus(amount);
    }
    return { lines, securitiesEur: total, cashEur: cashTotal, totalEur: total.plus(cashTotal) };
  }

  private holding(tx: TxInput): Holding {
    const key = `${tx.accountId}|${tx.instrumentId}`;
    let h = this.holdings.get(key);
    if (!h) {
      h = {
        accountId: tx.accountId,
        instrumentId: tx.instrumentId!,
        quantity: ZERO,
        costEur: ZERO,
        lastTradePrice: ZERO,
        lastTradeDate: tx.tradeDate,
      };
      this.holdings.set(key, h);
    }
    return h;
  }

  private addCash(accountId: string, amount: Decimal) {
    this.cash.set(accountId, (this.cash.get(accountId) ?? ZERO).plus(amount));
  }
}

export type HoldingValuation = Holding & {
  instrument: InstrumentInput;
  price: Decimal;
  priceDate: string;
  priceSource: string;
  fxRate: Decimal;
  fxDate: string;
  valueEur: Decimal;
  unrealizedEur: Decimal;
};

function priceOf(
  instrument: InstrumentInput,
  h: Holding,
  date: string,
  prices: PortfolioData["prices"],
) {
  if (instrument.valuationMode === "nominal") {
    return { price: new Decimal(1), date, source: "valeur nominale" };
  }
  const p = lastPrice(prices.get(instrument.id), date);
  if (p && p.date >= h.lastTradeDate)
    return { price: dec(p.close), date: p.date, source: p.source };
  // Pas de cours plus récent que la dernière opération : on retient le prix de cette opération.
  return { price: h.lastTradePrice, date: h.lastTradeDate, source: "dernière transaction" };
}
