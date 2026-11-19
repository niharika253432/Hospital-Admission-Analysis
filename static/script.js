const money = n => '₹' + Number(n || 0).toLocaleString('en-IN');

const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            labels: {
                boxWidth: 12,
                font: { size: 10 }
            }
        }
    }
};

const palette = [
    '#287bd1',
    '#45b4a3',
    '#f3a54a',
    '#8874db',
    '#e16f8d',
    '#62a0bb'
];

function makeChart(id, type, labels, datasets, extra = {}) {
    const el = document.getElementById(id);

    if (!el) {
        console.warn('Chart element not found:', id);
        return;
    }

    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded.');
        return;
    }

    // Destroy an old chart before creating a new one
    if (Chart.getChart(el)) {
        Chart.getChart(el).destroy();
    }

    return new Chart(el, {
        type,
        data: {
            labels,
            datasets
        },
        options: {
            ...chartDefaults,
            ...extra,
            plugins: {
                ...chartDefaults.plugins,
                ...(extra.plugins || {})
            }
        }
    });
}

fetch('/api/analytics')
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch analytics data');
        }
        return response.json();
    })
    .then(d => {

        // Dashboard summary cards
        document.getElementById('admissions').textContent =
            d.total_admissions.toLocaleString();

        document.getElementById('bedDays').textContent =
            d.total_bed_days.toLocaleString();

        document.getElementById('billing').textContent =
            money(d.total_billing);

        document.getElementById('avgStay').textContent =
            d.average_stay + ' days';

        // Monthly Admissions
        makeChart(
            'monthlyChart',
            'bar',
            d.months,
            [
                {
                    label: 'Admissions',
                    data: d.monthly,
                    backgroundColor: '#c5ddf8',
                    borderRadius: 5
                },
                {
                    label: '3-month average',
                    data: d.rolling,
                    type: 'line',
                    borderColor: '#2076ca',
                    backgroundColor: '#2076ca',
                    tension: 0.3
                }
            ]
        );

        // Department Workload
        makeChart(
            'deptChart',
            'doughnut',
            Object.keys(d.departments),
            [
                {
                    data: Object.values(d.departments),
                    backgroundColor: palette
                }
            ]
        );

        // Age Group Utilization
        makeChart(
            'ageChart',
            'bar',
            Object.keys(d.age_bands),
            [
                {
                    label: 'Admissions',
                    data: Object.values(d.age_bands),
                    backgroundColor: '#62a0bb',
                    borderRadius: 5
                }
            ],
            {
                plugins: {
                    legend: { display: false }
                }
            }
        );

        // Admission Risk Categories
        makeChart(
            'riskChart',
            'doughnut',
            Object.keys(d.risk),
            [
                {
                    data: Object.values(d.risk),
                    backgroundColor: [
                        '#45b4a3',
                        '#f3a54a',
                        '#e16f8d',
                        '#8b5cf6'
                    ]
                }
            ]
        );

        // Payer Billing
        makeChart(
            'payerChart',
            'bar',
            Object.keys(d.payers),
            [
                {
                    label: 'Billing (INR)',
                    data: Object.values(d.payers).map(x => x.billing),
                    backgroundColor: '#8874db',
                    borderRadius: 5
                }
            ],
            {
                plugins: {
                    legend: { display: false }
                }
            }
        );

        // Top Diagnoses
        const diag = Object.entries(d.diagnoses)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 12);

        makeChart(
            'diagnosisChart',
            'bar',
            diag.map(x => x[0]),
            [
                {
                    label: 'Admissions',
                    data: diag.map(x => x[1]),
                    backgroundColor: '#45b4a3',
                    borderRadius: 5
                }
            ],
            {
                indexAxis: 'y',
                plugins: {
                    legend: { display: false }
                }
            }
        );

        // Longest Hospital Stays
        const table = document.getElementById('longestTable');

        if (table) {
            table.innerHTML = d.longest.map(r => `
                <tr>
                    <td>${r.admission_id}</td>
                    <td>${r.patient_age}</td>
                    <td>${r.department_name}</td>
                    <td>${r.diagnosis}</td>
                    <td>${r.length_of_stay_days}</td>
                    <td>${r.admission_type}</td>
                </tr>
            `).join('');
        }

        console.log('Hospital analytics loaded successfully!');
    })
    .catch(error => {
        console.error('Dashboard error:', error);

        document.body.insertAdjacentHTML(
            'beforeend',
            '<p style="color:red;text-align:center;">Unable to load dashboard data. Check that the app is running.</p>'
        );
    });