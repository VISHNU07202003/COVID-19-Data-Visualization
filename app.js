// Global variables
let globalData = [];
let historicalData = null;
let currentMetric = 'cases';
let currentContinent = 'all';

// API endpoints
const API_BASE = 'https://disease.sh/v3/covid-19';
const ENDPOINTS = {
    global: `${API_BASE}/all`,
    countries: `${API_BASE}/countries`,
    historical: `${API_BASE}/historical/all?lastdays=365`
};

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', async () => {
    showLoading();
    await initializeDashboard();
    setupEventListeners();
    hideLoading();
});

// Initialize dashboard with data
async function initializeDashboard() {
    try {
        // Fetch all data
        const [globalStats, countriesData, historical] = await Promise.all([
            fetch(ENDPOINTS.global).then(res => res.json()),
            fetch(ENDPOINTS.countries).then(res => res.json()),
            fetch(ENDPOINTS.historical).then(res => res.json())
        ]);

        globalData = countriesData;
        historicalData = historical;

        // Update UI
        updateGlobalStats(globalStats);
        updateLastUpdated();
        renderAllVisualizations();
        populateDataTable(globalData);

    } catch (error) {
        console.error('Error fetching data:', error);
        alert('Failed to load COVID-19 data. Please refresh the page.');
    }
}

// Update global statistics cards
function updateGlobalStats(data) {
    document.getElementById('global-cases').textContent = formatNumber(data.cases);
    document.getElementById('global-deaths').textContent = formatNumber(data.deaths);
    document.getElementById('global-recovered').textContent = formatNumber(data.recovered);
    document.getElementById('global-active').textContent = formatNumber(data.active);
    
    document.getElementById('cases-today').textContent = `+${formatNumber(data.todayCases)} today`;
    document.getElementById('deaths-today').textContent = `+${formatNumber(data.todayDeaths)} today`;
    document.getElementById('recovered-today').textContent = `+${formatNumber(data.todayRecovered)} today`;
}

// Update last updated timestamp
function updateLastUpdated() {
    const now = new Date();
    const formatted = now.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    document.getElementById('last-updated').textContent = `Last updated: ${formatted}`;
}

// Setup event listeners
function setupEventListeners() {
    // Metric selector
    document.getElementById('metric-select').addEventListener('change', (e) => {
        currentMetric = e.target.value;
        renderAllVisualizations();
    });

    // Continent filter
    document.getElementById('continent-filter').addEventListener('change', (e) => {
        currentContinent = e.target.value;
        renderAllVisualizations();
        populateDataTable(getFilteredData());
    });

    // Country search
    document.getElementById('country-search').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filtered = globalData.filter(country => 
            country.country.toLowerCase().includes(searchTerm)
        );
        populateDataTable(filtered);
    });

    // Reset button
    document.getElementById('reset-btn').addEventListener('click', () => {
        document.getElementById('metric-select').value = 'cases';
        document.getElementById('continent-filter').value = 'all';
        document.getElementById('country-search').value = '';
        currentMetric = 'cases';
        currentContinent = 'all';
        renderAllVisualizations();
        populateDataTable(globalData);
    });

    // Table search
    document.getElementById('table-search').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filtered = globalData.filter(country => 
            country.country.toLowerCase().includes(searchTerm) ||
            country.continent?.toLowerCase().includes(searchTerm)
        );
        populateDataTable(filtered);
    });

    // Export CSV
    document.getElementById('export-csv').addEventListener('click', exportToCSV);

    // Table sorting
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            sortTable(field);
        });
    });
}

// Render all visualizations
function renderAllVisualizations() {
    const filteredData = getFilteredData();
    renderWorldMap(filteredData);
    renderBarChart(filteredData);
    renderTimelineChart(historicalData);
    renderScatterPlot(filteredData);
    renderPieChart(filteredData);
}

// Get filtered data based on current continent
function getFilteredData() {
    if (currentContinent === 'all') {
        return globalData;
    }
    return globalData.filter(country => country.continent === currentContinent);
}

// Utility functions
function formatNumber(num) {
    if (!num) return '0';
    return num.toLocaleString('en-US');
}

function showLoading() {
    document.getElementById('loading-overlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
}

// Tooltip functions
function showTooltip(html, event) {
    const tooltip = document.getElementById('tooltip');
    tooltip.innerHTML = html;
    tooltip.classList.add('show');
    tooltip.style.left = (event.pageX + 10) + 'px';
    tooltip.style.top = (event.pageY + 10) + 'px';
}

function hideTooltip() {
    document.getElementById('tooltip').classList.remove('show');
}
// ============================================
// WORLD MAP CHOROPLETH VISUALIZATION
// ============================================
async function renderWorldMap(data) {
    const container = document.getElementById('world-map');
    container.innerHTML = ''; // Clear previous

    const width = container.clientWidth;
    const height = 500;

    const svg = d3.select('#world-map')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    // Create color scale based on current metric
    const values = data.map(d => d[currentMetric]).filter(v => v > 0);
    const colorScale = d3.scaleSequential()
        .domain([0, d3.max(values)])
        .interpolator(d3.interpolateReds);

    // Create map projection
    const projection = d3.geoMercator()
        .scale(width / 6.5)
        .translate([width / 2, height / 1.5]);

    const path = d3.geoPath().projection(projection);

    try {
        // Load world topology
        const world = await d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
        const countries = topojson.feature(world, world.objects.countries);

        // Create country lookup
        const dataMap = new Map(data.map(d => [d.country, d]));

        // Draw countries
        svg.selectAll('path')
            .data(countries.features)
            .join('path')
            .attr('class', 'country')
            .attr('d', path)
            .attr('fill', d => {
                const countryData = dataMap.get(d.properties.name);
                if (!countryData || !countryData[currentMetric]) {
                    return '#2f2f2f';
                }
                return colorScale(countryData[currentMetric]);
            })
            .on('mouseover', function(event, d) {
                const countryData = dataMap.get(d.properties.name);
                if (countryData) {
                    const html = `
                        <h4>${countryData.country}</h4>
                        <p><strong>Cases:</strong> ${formatNumber(countryData.cases)}</p>
                        <p><strong>Deaths:</strong> ${formatNumber(countryData.deaths)}</p>
                        <p><strong>Recovered:</strong> ${formatNumber(countryData.recovered)}</p>
                        <p><strong>Active:</strong> ${formatNumber(countryData.active)}</p>
                    `;
                    showTooltip(html, event);
                }
                d3.select(this).style('opacity', 0.8);
            })
            .on('mouseout', function() {
                hideTooltip();
                d3.select(this).style('opacity', 1);
            });

        // Add legend
        createMapLegend(colorScale, values);

    } catch (error) {
        console.error('Error rendering world map:', error);
        container.innerHTML = '<p style="color: #ff4444; text-align: center; padding: 2rem;">Failed to load map data</p>';
    }
}

function createMapLegend(colorScale, values) {
    const legendContainer = document.getElementById('map-legend');
    legendContainer.innerHTML = '';

    const steps = 5;
    const max = d3.max(values);
    const step = max / steps;

    for (let i = 0; i < steps; i++) {
        const value = step * i;
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        
        const colorBox = document.createElement('div');
        colorBox.className = 'legend-color';
        colorBox.style.backgroundColor = colorScale(value);
        
        const label = document.createElement('span');
        label.textContent = formatNumber(Math.round(value));
        
        legendItem.appendChild(colorBox);
        legendItem.appendChild(label);
        legendContainer.appendChild(legendItem);
    }
}

// ============================================
// BAR CHART - TOP 20 COUNTRIES
// ============================================
function renderBarChart(data) {
    const container = document.getElementById('bar-chart');
    container.innerHTML = '';

    const width = container.clientWidth;
    const height = 500;
    const margin = { top: 20, right: 30, bottom: 100, left: 80 };

    // Get top 20 countries
    const topCountries = [...data]
        .filter(d => d[currentMetric] > 0)
        .sort((a, b) => b[currentMetric] - a[currentMetric])
        .slice(0, 20);

    const svg = d3.select('#bar-chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Scales
    const xScale = d3.scaleBand()
        .domain(topCountries.map(d => d.country))
        .range([0, chartWidth])
        .padding(0.2);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(topCountries, d => d[currentMetric])])
        .nice()
        .range([chartHeight, 0]);

    // Color scale
    const colorScale = d3.scaleSequential()
        .domain([0, topCountries.length - 1])
        .interpolator(d3.interpolateReds);

    // Add grid
    g.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(yScale)
            .tickSize(-chartWidth)
            .tickFormat('')
        );

    // Add bars
    g.selectAll('.bar')
        .data(topCountries)
        .join('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.country))
        .attr('y', chartHeight)
        .attr('width', xScale.bandwidth())
        .attr('height', 0)
        .attr('fill', (d, i) => colorScale(i))
        .on('mouseover', function(event, d) {
            const html = `
                <h4>${d.country}</h4>
                <p><strong>${getMetricLabel(currentMetric)}:</strong> ${formatNumber(d[currentMetric])}</p>
            `;
            showTooltip(html, event);
            d3.select(this).attr('opacity', 0.7);
        })
        .on('mouseout', function() {
            hideTooltip();
            d3.select(this).attr('opacity', 1);
        })
        .transition()
        .duration(800)
        .attr('y', d => yScale(d[currentMetric]))
        .attr('height', d => chartHeight - yScale(d[currentMetric]));

    // X axis
    g.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${chartHeight})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end');

    // Y axis
    g.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(yScale)
            .ticks(5)
            .tickFormat(d => formatNumber(d)));

    // Y axis label
    g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -margin.left + 20)
        .attr('x', -chartHeight / 2)
        .attr('fill', '#ffffff')
        .style('text-anchor', 'middle')
        .text(getMetricLabel(currentMetric));
}

// ============================================
// TIMELINE CHART - HISTORICAL DATA
// ============================================
function renderTimelineChart(historical) {
    const container = document.getElementById('timeline-chart');
    container.innerHTML = '';

    if (!historical || !historical.cases) {
        container.innerHTML = '<p style="text-align: center; padding: 2rem;">No historical data available</p>';
        return;
    }

    const width = container.clientWidth;
    const height = 400;
    const margin = { top: 20, right: 30, bottom: 50, left: 80 };

    const svg = d3.select('#timeline-chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Parse data
    const dates = Object.keys(historical.cases);
    const parseDate = d3.timeParse('%m/%d/%y');
    
    const data = dates.map(date => ({
        date: parseDate(date),
        cases: historical.cases[date],
        deaths: historical.deaths[date],
        recovered: historical.recovered?.[date] || 0
    }));

    // Scales
    const xScale = d3.scaleTime()
        .domain(d3.extent(data, d => d.date))
        .range([0, chartWidth]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.cases)])
        .nice()
        .range([chartHeight, 0]);

    // Line generator
    const line = d3.line()
        .x(d => xScale(d.date))
        .y(d => yScale(d.cases))
        .curve(d3.curveMonotoneX);

    // Add grid
    g.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(yScale)
            .tickSize(-chartWidth)
            .tickFormat('')
        );

    // Add line path
    const path = g.append('path')
        .datum(data)
        .attr('class', 'line-path')
        .attr('d', line);

    // Animate line
    const totalLength = path.node().getTotalLength();
    path
        .attr('stroke-dasharray', totalLength + ' ' + totalLength)
        .attr('stroke-dashoffset', totalLength)
        .transition()
        .duration(2000)
        .ease(d3.easeLinear)
        .attr('stroke-dashoffset', 0);

    // Add dots
    g.selectAll('.dot')
        .data(data.filter((d, i) => i % 30 === 0)) // Show every 30th day
        .join('circle')
        .attr('class', 'dot')
        .attr('cx', d => xScale(d.date))
        .attr('cy', d => yScale(d.cases))
        .attr('r', 0)
        .attr('fill', '#E50914')
        .on('mouseover', function(event, d) {
            const html = `
                <h4>${d.date.toLocaleDateString()}</h4>
                <p><strong>Cases:</strong> ${formatNumber(d.cases)}</p>
                <p><strong>Deaths:</strong> ${formatNumber(d.deaths)}</p>
                <p><strong>Recovered:</strong> ${formatNumber(d.recovered)}</p>
            `;
            showTooltip(html, event);
        })
        .on('mouseout', hideTooltip)
        .transition()
        .delay((d, i) => i * 50)
        .duration(500)
        .attr('r', 4);

    // X axis
    g.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${chartHeight})`)
        .call(d3.axisBottom(xScale)
            .ticks(6)
            .tickFormat(d3.timeFormat('%b %Y')));

    // Y axis
    g.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(yScale)
            .ticks(5)
            .tickFormat(d => formatNumber(d)));

    // Y axis label
    g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -margin.left + 20)
        .attr('x', -chartHeight / 2)
        .attr('fill', '#ffffff')
        .style('text-anchor', 'middle')
        .text('Total Cases');
}

// ============================================
// SCATTER PLOT - CASES VS DEATHS
// ============================================
function renderScatterPlot(data) {
    const container = document.getElementById('scatter-plot');
    container.innerHTML = '';

    const width = container.clientWidth;
    const height = 400;
    const margin = { top: 20, right: 30, bottom: 60, left: 80 };

    const svg = d3.select('#scatter-plot')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Filter data with both cases and deaths
    const validData = data.filter(d => d.cases > 0 && d.deaths > 0);

    // Scales
    const xScale = d3.scaleLog()
        .domain([1, d3.max(validData, d => d.cases)])
        .range([0, chartWidth]);

    const yScale = d3.scaleLog()
        .domain([1, d3.max(validData, d => d.deaths)])
        .range([chartHeight, 0]);

    const sizeScale = d3.scaleSqrt()
        .domain([0, d3.max(validData, d => d.population)])
        .range([2, 30]);

    // Add grid
    g.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(yScale)
            .tickSize(-chartWidth)
            .tickFormat('')
        );

    // Add dots
    g.selectAll('.dot')
        .data(validData)
        .join('circle')
        .attr('class', 'dot')
        .attr('cx', d => xScale(d.cases))
        .attr('cy', d => yScale(d.deaths))
        .attr('r', 0)
        .attr('fill', '#E50914')
        .attr('opacity', 0.6)
        .on('mouseover', function(event, d) {
            const html = `
                <h4>${d.country}</h4>
                <p><strong>Cases:</strong> ${formatNumber(d.cases)}</p>
                <p><strong>Deaths:</strong> ${formatNumber(d.deaths)}</p>
                <p><strong>Population:</strong> ${formatNumber(d.population)}</p>
                <p><strong>Death Rate:</strong> ${((d.deaths / d.cases) * 100).toFixed(2)}%</p>
            `;
            showTooltip(html, event);
            d3.select(this)
                .attr('stroke', '#ffffff')
                .attr('stroke-width', 2);
        })
        .on('mouseout', function() {
            hideTooltip();
            d3.select(this)
                .attr('stroke', 'none');
        })
        .transition()
        .duration(800)
        .delay((d, i) => i * 2)
        .attr('r', d => sizeScale(d.population || 1000000));

    // X axis
    g.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${chartHeight})`)
        .call(d3.axisBottom(xScale)
            .ticks(5)
            .tickFormat(d => formatNumber(d)));

    // Y axis
    g.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(yScale)
            .ticks(5)
            .tickFormat(d => formatNumber(d)));

    // X axis label
    g.append('text')
        .attr('x', chartWidth / 2)
        .attr('y', chartHeight + margin.bottom - 10)
        .attr('fill', '#ffffff')
        .style('text-anchor', 'middle')
        .text('Total Cases (log scale)');

    // Y axis label
    g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -margin.left + 20)
        .attr('x', -chartHeight / 2)
        .attr('fill', '#ffffff')
        .style('text-anchor', 'middle')
        .text('Total Deaths (log scale)');
}

// ============================================
// PIE CHART - CONTINENTAL DISTRIBUTION
// ============================================
function renderPieChart(data) {
    const container = document.getElementById('pie-chart');
    container.innerHTML = '';

    const width = container.clientWidth;
    const height = 400;
    const radius = Math.min(width, height) / 2 - 40;

    const svg = d3.select('#pie-chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${width / 2},${height / 2})`);

    // Aggregate data by continent
    const continentData = d3.rollup(
        data.filter(d => d.continent),
        v => d3.sum(v, d => d[currentMetric]),
        d => d.continent
    );

    const pieData = Array.from(continentData, ([continent, value]) => ({
        continent,
        value
    })).sort((a, b) => b.value - a.value);

    // Color scale
    const colorScale = d3.scaleOrdinal()
        .domain(pieData.map(d => d.continent))
        .range(['#E50914', '#ff6b6b', '#ff9999', '#ffcccc', '#ffeaea', '#fff5f5']);

    // Pie layout
    const pie = d3.pie()
        .value(d => d.value)
        .sort(null);

    const arc = d3.arc()
        .innerRadius(radius * 0.4) // Donut chart
        .outerRadius(radius);

    const arcHover = d3.arc()
        .innerRadius(radius * 0.4)
        .outerRadius(radius * 1.1);

    // Draw slices
    const slices = svg.selectAll('.slice')
        .data(pie(pieData))
        .join('g')
        .attr('class', 'slice');

    slices.append('path')
        .attr('d', arc)
        .attr('fill', d => colorScale(d.data.continent))
        .attr('stroke', '#141414')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .attr('d', arcHover);

            const percentage = ((d.data.value / d3.sum(pieData, d => d.value)) * 100).toFixed(1);
            const html = `
                <h4>${d.data.continent}</h4>
                <p><strong>${getMetricLabel(currentMetric)}:</strong> ${formatNumber(d.data.value)}</p>
                <p><strong>Percentage:</strong> ${percentage}%</p>
            `;
            showTooltip(html, event);
        })
        .on('mouseout', function() {
            d3.select(this)
                .transition()
                .duration(200)
                .attr('d', arc);
            hideTooltip();
        })
        .transition()
        .duration(800)
        .attrTween('d', function(d) {
            const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
            return function(t) {
                return arc(i(t));
            };
        });

    // Add labels
    slices.append('text')
        .attr('transform', d => `translate(${arc.centroid(d)})`)
        .attr('text-anchor', 'middle')
        .attr('fill', '#ffffff')
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .style('opacity', 0)
        .text(d => d.data.continent)
        .transition()
        .delay(800)
        .duration(500)
        .style('opacity', 1);

    // Add center text
    svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '-0.5em')
        .attr('fill', '#ffffff')
        .attr('font-size', '14px')
        .attr('font-weight', 'bold')
        .text('Total');

    svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '1em')
        .attr('fill', '#E50914')
        .attr('font-size', '20px')
        .attr('font-weight', 'bold')
        .text(formatNumber(d3.sum(pieData, d => d.value)));
}

// ============================================
// DATA TABLE
// ============================================
function populateDataTable(data) {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    data.forEach(country => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${country.country}</td>
            <td>${country.continent || 'N/A'}</td>
            <td>${formatNumber(country.cases)}</td>
            <td style="color: ${country.todayCases > 0 ? '#ff6b6b' : '#808080'}">${formatNumber(country.todayCases)}</td>
            <td>${formatNumber(country.deaths)}</td>
            <td>${formatNumber(country.recovered)}</td>
            <td>${formatNumber(country.active)}</td>
            <td>${formatNumber(country.casesPerOneMillion)}</td>
        `;
    });
}

// Sort table
let sortDirection = {};

function sortTable(field) {
    sortDirection[field] = !sortDirection[field];
    const direction = sortDirection[field] ? 1 : -1;

    globalData.sort((a, b) => {
        let valA = a[field];
        let valB = b[field];

        if (typeof valA === 'string') {
            return direction * valA.localeCompare(valB);
        }
        return direction * (valA - valB);
    });

    populateDataTable(getFilteredData());
}

// Export to CSV
function exportToCSV() {
    const headers = ['Country', 'Continent', 'Cases', 'Today Cases', 'Deaths', 'Recovered', 'Active', 'Cases Per Million'];
    const rows = globalData.map(country => [
        country.country,
        country.continent || '',
        country.cases,
        country.todayCases,
        country.deaths,
        country.recovered,
        country.active,
        country.casesPerOneMillion
    ]);

    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
        csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `covid19_data_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Utility function for metric labels
function getMetricLabel(metric) {
    const labels = {
        cases: 'Total Cases',
        deaths: 'Total Deaths',
        recovered: 'Total Recovered',
        active: 'Active Cases',
        casesPerMillion: 'Cases per Million',
        deathsPerMillion: 'Deaths per Million'
    };
    return labels[metric] || metric;
}







