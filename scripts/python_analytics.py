#!/usr/bin/env python3
"""
VivPay Financial Analytics Engine (Python 3.10+)
Phase 1 Web App + Data Analytics (W1 Deliverable)

Computes deterministic financial analytics, descriptive statistics,
spending intelligence, recurring cadence detection, statistical anomaly scoring,
and ordinary least squares (OLS) predictive cash flow projections.
"""

import sys
import json
import math
import statistics
from datetime import datetime
from collections import defaultdict
from typing import List, Dict, Any, Optional

def safe_float(val: Any, default: float = 0.0) -> float:
    """Safely converts input to a finite float, rejecting NaN, Inf, and invalid types."""
    try:
        if val is None or isinstance(val, (bool, list, dict)):
            return default
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return default
        return f
    except (ValueError, TypeError):
        return default

def parse_date(date_str: Any) -> Optional[datetime]:
    """Robust date parser handling common ISO, UK, and US financial statement date representations."""
    if not date_str or not isinstance(date_str, str):
        return None
    cleaned = date_str.strip()
    formats = [
        "%Y-%m-%d",
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d %H:%M:%S",
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%m/%d/%Y",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(cleaned, fmt)
        except (ValueError, AttributeError):
            continue
    return None

def compute_financial_analytics(transactions: List[Any], starting_balance: float = 0.0) -> Dict[str, Any]:
    safe_starting_balance = safe_float(starting_balance, 0.0)

    # Filter and sanitize valid transaction dictionaries
    valid_transactions: List[Dict[str, Any]] = []
    if isinstance(transactions, list):
        for item in transactions:
            if isinstance(item, dict):
                valid_transactions.append(item)

    if not valid_transactions:
        return {
            "status": "empty",
            "totalTransactions": 0,
            "metrics": {
                "totalInflow": 0.0,
                "totalOutflow": 0.0,
                "netCashFlow": 0.0,
                "savingsRatePct": 0.0,
                "averageExpense": 0.0,
                "medianExpense": 0.0,
                "expenseStdDev": 0.0,
            },
            "categoryBreakdown": [],
            "topMerchants": [],
            "monthlyTrends": [],
            "anomalies": [],
            "recurringCandidates": [],
            "linearProjection": {
                "dailySlope": 0.0,
                "projected30DayBalance": round(safe_starting_balance, 2),
                "trendDirection": "neutral",
                "notes": "Insufficient transaction history for linear trend extrapolation."
            },
            "healthScore": 50,
            "engine": "Python 3.10 Deterministic Financial Analytics"
        }

    total_inflow = 0.0
    total_outflow = 0.0
    expenses: List[float] = []
    category_totals = defaultdict(lambda: {"total": 0.0, "count": 0})
    merchant_totals = defaultdict(lambda: {"total": 0.0, "count": 0, "dates": []})
    monthly_data = defaultdict(lambda: {"inflow": 0.0, "outflow": 0.0, "count": 0})
    dated_transactions = []

    for tx in valid_transactions:
        raw_amt = safe_float(tx.get("amount"), 0.0)
        raw_type = tx.get("type")
        tx_type = str(raw_type).strip().lower() if raw_type is not None else "debit"
        
        raw_cat = tx.get("category") or tx.get("categoryName") or "Uncategorized"
        category = str(raw_cat).strip() or "Uncategorized"
        
        raw_merch = tx.get("merchantName") or tx.get("description") or "Unknown"
        merchant = str(raw_merch).strip() or "Unknown"
        
        date_raw = tx.get("date")
        parsed_dt = parse_date(date_raw)

        if tx_type == "credit" or raw_amt < 0:
            abs_amt = abs(raw_amt)
            total_inflow += abs_amt
        else:
            abs_amt = abs(raw_amt)
            total_outflow += abs_amt
            if abs_amt > 0:
                expenses.append(abs_amt)
            category_totals[category]["total"] += abs_amt
            category_totals[category]["count"] += 1
            merchant_totals[merchant]["total"] += abs_amt
            merchant_totals[merchant]["count"] += 1
            if parsed_dt:
                merchant_totals[merchant]["dates"].append(parsed_dt)

        if parsed_dt:
            month_key = parsed_dt.strftime("%Y-%m")
            if tx_type == "credit" or raw_amt < 0:
                monthly_data[month_key]["inflow"] += abs(raw_amt)
            else:
                monthly_data[month_key]["outflow"] += abs(raw_amt)
            monthly_data[month_key]["count"] += 1
            dated_transactions.append((parsed_dt, abs(raw_amt) if tx_type == "credit" or raw_amt < 0 else -abs(raw_amt)))

    net_cash_flow = total_inflow - total_outflow

    # Savings rate with edge-case handling (zero income vs zero expense)
    if total_inflow > 0:
        savings_rate = round((net_cash_flow / total_inflow * 100.0), 1)
    elif total_outflow == 0:
        savings_rate = 0.0
    else:
        savings_rate = -100.0

    avg_expense = statistics.mean(expenses) if expenses else 0.0
    med_expense = statistics.median(expenses) if expenses else 0.0
    std_expense = statistics.stdev(expenses) if len(expenses) > 1 else 0.0

    # Category breakdown sorted descending by spend
    cat_breakdown = []
    for cat, data in sorted(category_totals.items(), key=lambda item: item[1]["total"], reverse=True):
        pct = (data["total"] / total_outflow * 100.0) if total_outflow > 0 else 0.0
        cat_breakdown.append({
            "category": cat,
            "totalSpend": round(data["total"], 2),
            "percentage": round(pct, 1),
            "transactionCount": data["count"]
        })

    # Top 5 Merchants by spend
    top_merchants = []
    for merch, data in sorted(merchant_totals.items(), key=lambda item: item[1]["total"], reverse=True)[:5]:
        top_merchants.append({
            "merchant": merch,
            "totalSpend": round(data["total"], 2),
            "frequency": data["count"]
        })

    # Chronological monthly trends
    monthly_trends = []
    for m_key in sorted(monthly_data.keys()):
        m_info = monthly_data[m_key]
        monthly_trends.append({
            "month": m_key,
            "inflow": round(m_info["inflow"], 2),
            "outflow": round(m_info["outflow"], 2),
            "net": round(m_info["inflow"] - m_info["outflow"], 2),
            "transactionCount": m_info["count"]
        })

    # Statistical Outlier / Anomaly Detection (Z-Score >= 2.0 or 5x Median for extreme values)
    anomalies = []
    if len(expenses) >= 4:
        for tx in valid_transactions:
            raw_amt = safe_float(tx.get("amount"), 0.0)
            raw_type = tx.get("type")
            tx_type = str(raw_type).strip().lower() if raw_type is not None else "debit"
            if tx_type != "credit" and raw_amt > 0:
                amt = abs(raw_amt)
                z_score = ((amt - avg_expense) / std_expense) if std_expense > 0 else 0.0
                is_outlier = (z_score >= 2.0) or (med_expense > 0 and amt >= 5 * med_expense and amt > 2000)
                if is_outlier:
                    anomalies.append({
                        "id": tx.get("id"),
                        "description": tx.get("description"),
                        "amount": amt,
                        "date": str(tx.get("date")),
                        "zScore": round(z_score, 2),
                        "deviationFactor": round(amt / avg_expense, 1) if avg_expense > 0 else 1.0,
                        "explanation": f"Statistical outlier: Amount is {round(z_score, 1)} standard deviations above the average spending value."
                    })

    # Recurring Cadence Detection
    recurring = []
    for merch, data in merchant_totals.items():
        if data["count"] >= 2 and len(data["dates"]) >= 2:
            dates = sorted(data["dates"])
            intervals = [(dates[i] - dates[i-1]).days for i in range(1, len(dates))]
            if intervals:
                avg_interval = sum(intervals) / len(intervals)
                is_cadence = (25 <= avg_interval <= 35) or (6 <= avg_interval <= 8)
                variance = statistics.stdev(intervals) if len(intervals) > 1 else 0.0
                if is_cadence or (data["count"] >= 3 and variance < 5.0):
                    recurring.append({
                        "merchant": merch,
                        "cadence": "monthly" if avg_interval >= 20 else "weekly",
                        "averageIntervalDays": round(avg_interval, 1),
                        "totalSpent": round(data["total"], 2),
                        "frequency": data["count"],
                        "confidence": "high" if variance < 3.0 else "medium"
                    })

    # Linear Cash Flow Projection (OLS Regression on Cumulative Cash Flow)
    daily_slope = 0.0
    projected_30d = safe_starting_balance + net_cash_flow
    trend_dir = "neutral"
    projection_notes = "Sufficient historical dispersion for linear modeling."

    distinct_dates = set(dt for dt, _ in dated_transactions)
    if len(dated_transactions) >= 3 and len(distinct_dates) >= 2:
        dated_transactions.sort(key=lambda x: x[0])
        first_date = dated_transactions[0][0]
        x_vals = [(dt - first_date).days for dt, _ in dated_transactions]
        y_cum = []
        running = safe_starting_balance
        for _, flow in dated_transactions:
            running += flow
            y_cum.append(running)

        n = len(x_vals)
        sum_x = sum(x_vals)
        sum_y = sum(y_cum)
        sum_xx = sum(x * x for x in x_vals)
        sum_xy = sum(x * y for x, y in zip(x_vals, y_cum))
        denom = (n * sum_xx - sum_x * sum_x)
        if denom != 0:
            daily_slope = (n * sum_xy - sum_x * sum_y) / denom
            last_balance = y_cum[-1]
            projected_30d = max(0.0, last_balance + (daily_slope * 30))
            if daily_slope > 10.0:
                trend_dir = "positive"
            elif daily_slope < -10.0:
                trend_dir = "negative"
    else:
        projection_notes = "Insufficient distinct transaction dates (< 2 dates) for linear regression slope."

    # 10-Factor Health Score heuristic model (0-100)
    score = 50.0
    if savings_rate > 20: score += 15
    elif savings_rate > 0: score += 8
    else: score -= 15

    if net_cash_flow > 0: score += 10
    if len(cat_breakdown) >= 4: score += 5
    if len(recurring) > 0 and len(recurring) <= 8: score += 5
    if len(anomalies) == 0: score += 5
    elif len(anomalies) > 3: score -= 10
    if projected_30d >= safe_starting_balance: score += 10
    else: score -= 5

    final_score = int(max(10, min(95, round(score))))

    return {
        "status": "success",
        "totalTransactions": len(valid_transactions),
        "metrics": {
            "totalInflow": round(total_inflow, 2),
            "totalOutflow": round(total_outflow, 2),
            "netCashFlow": round(net_cash_flow, 2),
            "savingsRatePct": savings_rate,
            "averageExpense": round(avg_expense, 2),
            "medianExpense": round(med_expense, 2),
            "expenseStdDev": round(std_expense, 2),
        },
        "categoryBreakdown": cat_breakdown,
        "topMerchants": top_merchants,
        "monthlyTrends": monthly_trends,
        "anomalies": anomalies,
        "recurringCandidates": recurring,
        "linearProjection": {
            "dailySlope": round(daily_slope, 2),
            "projected30DayBalance": round(projected_30d, 2),
            "trendDirection": trend_dir,
            "notes": projection_notes
        },
        "healthScore": final_score,
        "engine": "Python 3.10 Deterministic Financial Analytics"
    }

def main():
    try:
        raw_input = sys.stdin.read().strip()
        if not raw_input:
            print(json.dumps({
                "status": "empty",
                "totalTransactions": 0,
                "error": "No transaction payload received via stdin."
            }))
            sys.exit(0)

        try:
            payload = json.loads(raw_input)
        except Exception:
            print(json.dumps({
                "status": "error",
                "error": "Invalid JSON payload provided to analytics engine."
            }))
            sys.exit(0)

        if isinstance(payload, list):
            transactions = payload
            balance = 0.0
        elif isinstance(payload, dict):
            transactions = payload.get("transactions", [])
            balance = safe_float(payload.get("startingBalance", 0.0))
        else:
            transactions = []
            balance = 0.0

        result = compute_financial_analytics(transactions, starting_balance=balance)
        print(json.dumps(result, indent=2))
        sys.exit(0)
    except Exception as e:
        print(json.dumps({"error": "Failed to compute financial analytics.", "status": "failed"}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
