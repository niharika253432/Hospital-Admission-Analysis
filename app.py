from flask import Flask, render_template, jsonify
import csv
from collections import Counter, defaultdict
from datetime import datetime
from statistics import mean

app = Flask(__name__)
DATA_FILE = 'hospital_admissions.csv'


def load_records():
    with open(DATA_FILE, newline='', encoding='utf-8') as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        r['patient_age'] = int(r['patient_age'])
        r['length_of_stay_days'] = int(r['length_of_stay_days'])
        r['total_bill_inr'] = int(r['total_bill_inr'])
        r['admission_date_obj'] = datetime.strptime(r['admission_date'], '%Y-%m-%d')
    return rows


def risk_for(r):
    score = 0
    if r['patient_age'] >= 65: score += 2
    elif r['patient_age'] >= 45: score += 1
    if r['admission_type'] == 'Emergency': score += 2
    if r['length_of_stay_days'] >= 14: score += 2
    elif r['length_of_stay_days'] >= 7: score += 1
    if r.get('readmitted_30d') == 'Y': score += 2
    if r.get('ward_type', '').lower() == 'icu': score += 2
    if score >= 6: return 'Critical'
    if score >= 4: return 'High'
    if score >= 2: return 'Moderate'
    return 'Low'


@app.route('/')
def home():
    return render_template('index.html')


@app.route('/api/analytics')
def analytics():
    rows = load_records()
    month_counts = Counter(r['admission_date_obj'].strftime('%b') for r in rows)
    month_order = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    monthly = [month_counts[m] for m in month_order]
    rolling = [round(mean(monthly[max(0, i-2):i+1]), 2) for i in range(len(monthly))]
    departments = Counter(r['department_name'] for r in rows)
    diagnoses = Counter(r['diagnosis'] for r in rows)
    age_bands = {'0–17': 0, '18–35': 0, '36–55': 0, '56–74': 0, '75+': 0}
    payers = defaultdict(lambda: {'count': 0, 'billing': 0})
    risk_counts = Counter()
    for r in rows:
        a = r['patient_age']
        band = '0–17' if a <= 17 else '18–35' if a <= 35 else '36–55' if a <= 55 else '56–74' if a <= 74 else '75+'
        age_bands[band] += 1
        payers[r['insurance_type']]['count'] += 1
        payers[r['insurance_type']]['billing'] += r['total_bill_inr']
        risk_counts[risk_for(r)] += 1
    longest = sorted(rows, key=lambda x: x['length_of_stay_days'], reverse=True)[:10]
    return jsonify({
        'total_admissions': len(rows),
        'total_bed_days': sum(r['length_of_stay_days'] for r in rows),
        'total_billing': sum(r['total_bill_inr'] for r in rows),
        'average_stay': round(mean(r['length_of_stay_days'] for r in rows), 1),
        'months': month_order, 'monthly': monthly, 'rolling': rolling,
        'departments': dict(departments), 'diagnoses': dict(diagnoses),
        'age_bands': age_bands,
        'payers': dict(payers), 'risk': dict(risk_counts),
        'longest': [{k:r[k] for k in ['admission_id','patient_age','department_name','diagnosis','length_of_stay_days','admission_type']} for r in longest]
    })

if __name__ == '__main__':
    app.run(debug=True)
