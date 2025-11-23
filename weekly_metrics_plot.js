#!/usr/bin/env node

/**
 * Weekly Metrics Visualization
 *
 * Generates comprehensive charts of all metrics across weekly periods
 * for AI-assisted development analysis.
 *
 * Usage:
 *   node weekly_metrics_plot.js [--output metrics.html]
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
let outputFile = 'weekly_metrics.html';

for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--output' || args[i] === '-o') && args[i + 1]) {
    outputFile = args[i + 1];
    i++;
  }
}

// Comprehensive weekly data - all metrics including WIP
const weeklyData = [
  {
    week: 'Week 1',
    period: 'Oct 7-10',
    featurePRs: 0,
    locPerPR: null,
    locPerDev: 0,
    locPerToken: null,
    commentsPerPR: 0.00,
    testCoverage: null,
    cves: null,
    duplicatedLines: null,
    maintainability: null,
    reliability: null,
    security: null,
    codeSmells: null,
    nkt: null,
    cycleTime: null,
    tokensPerSP: null,
    tokensPerCycleTime: undefined,
    costPerLOC: null,
    costPerPR: null,
    costPerSP: null,
    storyPoints: null,
    wipSP: null,
    totalCost: 38.71,
    timeToContextWindow: null,
    autoCompactions: 0,
    manualCompactions: 0,
    totalPrompts: 0,
    avgPromptLength: 0,
    topCategory: null,
    topCategoryCount: 0,
    topSubcategory: null,
    topSubcategoryCount: 0,
    promptCategories: {},
    note: ''
  },
  {
    week: 'Week 2',
    period: 'Oct 13-17',
    featurePRs: 5,
    locPerPR: 2488,
    locPerDev: 6220,
    locPerToken: null,
    commentsPerPR: 2.00,
    testCoverage: null,
    cves: null,
    duplicatedLines: null,
    maintainability: null,
    reliability: null,
    security: null,
    codeSmells: null,
    nkt: 51.92,
    cycleTime: 0.43,
    tokensPerSP: null,
    tokensPerCycleTime: undefined,
    costPerLOC: 0.0132,
    costPerPR: 32.82,
    costPerSP: 13.68,
    storyPoints: 12,
    wipSP: null,
    totalCost: 164.12,
    timeToContextWindow: null,
    autoCompactions: 0,
    manualCompactions: 0,
    totalPrompts: 0,
    avgPromptLength: 0,
    topCategory: null,
    topCategoryCount: 0,
    topSubcategory: null,
    topSubcategoryCount: 0,
    promptCategories: {},
    note: ''
  },
  {
    week: 'Week 3',
    period: 'Oct 20-24',
    featurePRs: 6,
    locPerPR: 1536,
    locPerDev: 2524,
    locPerToken: null,
    commentsPerPR: 2.00,
    testCoverage: 79.86,
    cves: 0,
    duplicatedLines: 0,
    maintainability: 1,
    reliability: 1,
    security: 1,
    codeSmells: 5.2,
    nkt: 125.55,
    cycleTime: 0.96,
    tokensPerSP: null,
    tokensPerCycleTime: undefined,
    costPerLOC: 0.02,
    costPerPR: 30.65,
    costPerSP: 9.2,
    storyPoints: 20,
    wipSP: null,
    totalCost: 183.92,
    timeToContextWindow: null,
    autoCompactions: 0,
    manualCompactions: 0,
    totalPrompts: 0,
    avgPromptLength: 0,
    topCategory: null,
    topCategoryCount: 0,
    topSubcategory: null,
    topSubcategoryCount: 0,
    promptCategories: {},
    note: ''
  },
  {
    week: 'Week 4',
    period: 'Oct 27-31',
    featurePRs: 5,
    locPerPR: 1154,
    locPerDev: 1442,
    locPerToken: null,
    commentsPerPR: 2.00,
    testCoverage: 85.23,
    cves: 0,
    duplicatedLines: 0,
    maintainability: 1,
    reliability: 1,
    security: 1,
    codeSmells: 2.2,
    nkt: 31.81,
    cycleTime: 3.08,
    tokensPerSP: null,
    tokensPerCycleTime: undefined,
    costPerLOC: 0.0399,
    costPerPR: 46.06,
    costPerSP: 19.19,
    storyPoints: 12,
    wipSP: null,
    totalCost: 230.29,
    timeToContextWindow: null,
    autoCompactions: 0,
    manualCompactions: 0,
    totalPrompts: 0,
    avgPromptLength: 0,
    topCategory: null,
    topCategoryCount: 0,
    topSubcategory: null,
    topSubcategoryCount: 0,
    promptCategories: {},
    note: ''
  },
  {
    week: 'Week 5',
    period: 'Nov 3-7',
    featurePRs: 4,
    locPerPR: 1948,
    locPerDev: 3895,
    locPerToken: 23.8957,
    commentsPerPR: 2.00,
    testCoverage: 89.77,
    cves: 0,
    duplicatedLines: 0,
    maintainability: 1,
    reliability: 1,
    security: 1,
    codeSmells: 3.25,
    nkt: 51.16,
    cycleTime: 1.61,
    tokensPerSP: 23,
    tokensPerCycleTime: 51,
    costPerLOC: 0.0498,
    costPerPR: 96.9,
    costPerSP: 27.69,
    storyPoints: 14,
    wipSP: null,
    totalCost: 387.59,
    timeToContextWindow: null,
    autoCompactions: 0,
    manualCompactions: 0,
    totalPrompts: 0,
    avgPromptLength: 0,
    topCategory: null,
    topCategoryCount: 0,
    topSubcategory: null,
    topSubcategoryCount: 0,
    promptCategories: {},
    note: ''
  },
  {
    week: 'Week 6',
    period: 'Nov 10-14',
    featurePRs: 5,
    locPerPR: 1878,
    locPerDev: 3130,
    locPerToken: 0.0052,
    commentsPerPR: 3.00,
    testCoverage: 87.5,
    cves: 0,
    duplicatedLines: 0,
    maintainability: 1,
    reliability: 1,
    security: 1,
    codeSmells: 2,
    nkt: 60.35,
    cycleTime: 2.44,
    tokensPerSP: 113265,
    tokensPerCycleTime: 148544,
    costPerLOC: 0.0282,
    costPerPR: 52.91,
    costPerSP: 16.53,
    storyPoints: 16,
    wipSP: null,
    totalCost: 264.53,
    timeToContextWindow: 27.35,
    autoCompactions: 14,
    manualCompactions: 0,
    totalPrompts: 158,
    avgPromptLength: 679,
    topCategory: 'general',
    topCategoryCount: 48,
    topSubcategory: 'other',
    topSubcategoryCount: 48,
    promptCategories: {"general":{"count":48,"percentage":"30.4"},"bug_fix":{"count":42,"percentage":"26.6"},"feature_development":{"count":34,"percentage":"21.5"},"code_understanding":{"count":20,"percentage":"12.7"},"testing":{"count":12,"percentage":"7.6"},"version_control":{"count":1,"percentage":"0.6"},"configuration":{"count":1,"percentage":"0.6"}},
    note: ''
  }
];

// Filter valid data points for each metric
const validWeeks = weeklyData.filter(d => d.featurePRs > 0);

// Console summary
console.log('='.repeat(80));
console.log('WEEKLY METRICS SUMMARY');
console.log('='.repeat(80));
console.log();

weeklyData.forEach(w => {
  console.log(`${w.week} (${w.period}):`);
  console.log(`  Feature PRs: ${w.featurePRs || 'N/A'}`);
  console.log(`  LOC/PR: ${w.locPerPR || 'N/A'}`);
  console.log(`  Comments/PR: ${w.commentsPerPR !== null ? w.commentsPerPR.toFixed(2) : 'N/A'}`);
  console.log(`  Test Coverage: ${w.testCoverage ? w.testCoverage.toFixed(2) + '%' : 'N/A'}`);
  console.log(`  Code Smells: ${w.codeSmells || 'N/A'}`);
  console.log(`  NK/T: ${w.nkt ? w.nkt.toFixed(2) : 'N/A'}`);
  console.log(`  Story Points Completed: ${w.storyPoints || 'N/A'}`);
  console.log(`  Story Points WIP: ${w.wipSP || 'N/A'}`);
  console.log(`  Cost/SP: ${w.costPerSP ? '$' + w.costPerSP.toFixed(2) : 'N/A'}`);
  console.log(`  Note: ${w.note}`);
  console.log();
});

console.log('='.repeat(80));
console.log();

// Generate HTML with multiple charts
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI in SDLC Internal Report</title>
  <script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1600px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .header {
      background: white;
      padding: 30px;
      border-radius: 10px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 { margin: 0 0 10px 0; color: #333; }
    .subtitle { color: #666; font-size: 14px; }
    .chart-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(600px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }
    .chart-container {
      background: white;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .chart-container.full-width {
      grid-column: 1 / -1;
    }
    .key-insights {
      background: white;
      padding: 35px 40px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      margin-bottom: 24px;
      border-top: 3px solid #1976D2;
    }
    .key-insights h2 {
      margin: 0 0 8px 0;
      color: #1a1a1a;
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }
    .section-subtitle {
      color: #666;
      font-size: 13px;
      margin-bottom: 24px;
      font-weight: 400;
    }
    .insight-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      margin-top: 24px;
    }
    .insight-card {
      padding: 20px 24px;
      border: 1px solid #e5e5e5;
      background: #fafafa;
      border-radius: 6px;
      transition: all 0.2s ease;
    }
    .insight-card:hover {
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      border-color: #d0d0d0;
    }
    .insight-card.good { border-left: 4px solid #0D7C2E; }
    .insight-card.warning { border-left: 4px solid #E37400; }
    .insight-card.bad { border-left: 4px solid #C5221F; }
    .insight-title {
      font-weight: 500;
      margin-bottom: 8px;
      color: #5f6368;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .insight-value {
      font-size: 32px;
      font-weight: 600;
      color: #1a1a1a;
      margin: 8px 0;
      line-height: 1.2;
    }
    .insight-card.good .insight-value { color: #0D7C2E; }
    .insight-card.warning .insight-value { color: #E37400; }
    .insight-card.bad .insight-value { color: #C5221F; }
    .insight-desc {
      font-size: 13px;
      color: #70757a;
      line-height: 1.5;
      margin-top: 6px;
    }
    .category-section {
      margin-bottom: 40px;
    }
    .category-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px 30px;
      border-radius: 10px;
      margin-bottom: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .category-header h2 {
      margin: 0 0 5px 0;
      font-size: 24px;
      font-weight: 600;
    }
    .category-header p {
      margin: 0;
      opacity: 0.9;
      font-size: 14px;
    }
    .category-header.efficiency { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .category-header.satisfaction { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
    .category-header.adoption { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
    .category-header.quality { background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); }

    /* Token chart filter */
    .filter-bar {
      background: white;
      padding: 15px 30px;
      border-radius: 10px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .filter-label {
      font-weight: 500;
      color: #333;
    }
    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 50px;
      height: 24px;
    }
    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      transition: .4s;
      border-radius: 24px;
    }
    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: .4s;
      border-radius: 50%;
    }
    input:checked + .toggle-slider {
      background-color: #667eea;
    }
    input:checked + .toggle-slider:before {
      transform: translateX(26px);
    }
    .token-chart.hidden {
      display: none;
    }
    .filter-info {
      color: #666;
      font-size: 13px;
      margin-left: auto;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>AI in SDLC Internal Report</h1>
    <div class="subtitle">Performance Analysis Period: October 7 - November 11, 2025</div>
  </div>

  <!-- EFFICIENCY METRICS -->
  <div class="category-section">
    <div class="category-header efficiency">
      <h2>Efficiency Metrics</h2>
      <p>Token usage, code generation efficiency, and development velocity indicators</p>
    </div>
    <div class="chart-grid">
      <div class="chart-container">
        <div id="tokensPerSPChart"></div>
      </div>
      <div class="chart-container">
        <div id="locPerTokenChart"></div>
      </div>
      <div class="chart-container">
        <div id="locPerPRChart"></div>
      </div>
      <div class="chart-container">
        <div id="locPerDevChart"></div>
      </div>
      <div class="chart-container">
        <div id="tokensPerPRTimeChart"></div>
      </div>
      <div class="chart-container" style="grid-column: span 2;">
        <div id="tokensPerTicketScatterChart"></div>
      </div>
      <div class="chart-container">
        <div id="costPerLOCChart"></div>
      </div>
      <div class="chart-container">
        <div id="costPerPRChart"></div>
      </div>
      <div class="chart-container">
        <div id="costPerSPChart"></div>
      </div>
      <div class="chart-container">
        <div id="storyPointsChart"></div>
      </div>
      <div class="chart-container">
        <div id="featurePRsChart"></div>
      </div>
    </div>
  </div>

  <!-- SATISFACTION & TRUST METRICS -->
  <div class="category-section">
    <div class="category-header satisfaction">
      <h2>Satisfaction & Trust Metrics</h2>
      <p>Code review engagement and collaboration indicators</p>
    </div>
    <div class="chart-grid">
      <div class="chart-container">
        <div id="commentsChart"></div>
      </div>
    </div>
  </div>

  <!-- ADOPTION & MATURITY METRICS -->
  <div class="category-section">
    <div class="category-header adoption">
      <h2>Adoption & Maturity Metrics</h2>
      <p>AI tool sophistication, NK/T options value, and context management</p>
    </div>
    <div class="chart-grid">
      <div class="chart-container full-width">
        <div id="logNKvsLogTChart"></div>
      </div>
      <div class="chart-container">
        <div id="contextWindowTimeChart"></div>
      </div>
      <div class="chart-container">
        <div id="compactionsChart"></div>
      </div>
    </div>
  </div>

  <!-- QUALITY METRICS -->
  <div class="category-section">
    <div class="category-header quality">
      <h2>Quality Metrics</h2>
      <p>Code quality, security, maintainability, and test coverage indicators</p>
    </div>
    <div class="chart-grid">
      <div class="chart-container">
        <div id="testCoverageChart"></div>
      </div>
      <div class="chart-container">
        <div id="cvesChart"></div>
      </div>
      <div class="chart-container">
        <div id="duplicatedLinesChart"></div>
      </div>
      <div class="chart-container">
        <div id="maintainabilityChart"></div>
      </div>
      <div class="chart-container">
        <div id="reliabilityChart"></div>
      </div>
      <div class="chart-container">
        <div id="securityChart"></div>
      </div>
      <div class="chart-container">
        <div id="codeSmellsChart"></div>
      </div>
    </div>
  </div>

  <!-- COST BREAKDOWN -->
  <div class="category-section">
    <div class="category-header" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);">
      <h2>Cost Breakdown</h2>
      <p>AWS Bedrock spending analysis by model and infrastructure</p>
    </div>
    <div class="chart-grid">
      <div class="chart-container">
        <div id="costModelChart"></div>
      </div>
      <div class="chart-container">
        <div id="costCategoryChart"></div>
      </div>
    </div>
  </div>

  <!-- DEVELOPER ACTIVITY -->
  <div class="category-section">
    <div class="category-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
      <h2>Developer Activity & Usage Patterns</h2>
      <p>What developers are asking Claude Code to do - prompt categories and engagement metrics</p>
    </div>
    <div class="chart-grid">
      <div class="chart-container full-width">
        <div id="promptCategoriesChart"></div>
      </div>
    </div>
  </div>

  <script>
    const weeklyData = ${JSON.stringify(weeklyData)};
    const allWeeks = weeklyData; // Include ALL weeks, even Week 1 with 0s

    // Common layout settings
    const commonLayout = {
      font: { family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
      plot_bgcolor: '#fafafa',
      paper_bgcolor: 'white',
      margin: { l: 60, r: 30, t: 50, b: 80 },
    };

    function createSimpleChart(elementId, yData, title, yAxisTitle, color = '#2196F3', rangeMin = 0) {
      const trace = {
        x: allWeeks.map(d => d.period),
        y: yData,
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: color, width: 3 },
        marker: { size: 10, color: color },
        connectgaps: false, // Don't connect lines across null values
        hovertemplate: '<b>%{x}</b><br>' + yAxisTitle + ': %{y}<extra></extra>'
      };

      Plotly.newPlot(elementId, [trace], {
        ...commonLayout,
        title: title,
        xaxis: { title: 'Week' },
        yaxis: {
          title: yAxisTitle,
          gridcolor: '#e0e0e0',
          rangemode: 'tozero', // Ensure y-axis starts at 0
          range: [rangeMin, null] // Set minimum to 0 or custom value
        },
        height: 350,
      }, { responsive: true });
    }

    // 1. Log-Log Plot: log(NK) vs log(T)
    const weeksWithData = allWeeks.filter(d => d.nkt !== null && d.cycleTime !== null && d.featurePRs > 0);

    // Calculate NK and use actual cycle time T for each week
    const logLogData = weeksWithData.map((d, index) => {
      const T = d.cycleTime; // Actual cycle time in days
      const NK = d.nkt * T; // NK = (NK/T) * T = parallel work capacity
      return {
        period: d.period,
        week: index + 2, // Week 2, 3, 4, 5
        T: T,
        NK: NK,
        logT: Math.log10(T),
        logNK: Math.log10(NK)
      };
    });

    // Calculate linear regression for trend line
    const n = logLogData.length;
    const sumX = logLogData.reduce((sum, d) => sum + d.logT, 0);
    const sumY = logLogData.reduce((sum, d) => sum + d.logNK, 0);
    const sumXY = logLogData.reduce((sum, d) => sum + d.logT * d.logNK, 0);
    const sumX2 = logLogData.reduce((sum, d) => sum + d.logT * d.logT, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Generate trend line points
    const minLogT = Math.min(...logLogData.map(d => d.logT));
    const maxLogT = Math.max(...logLogData.map(d => d.logT));
    const trendLine = [
      { x: minLogT, y: slope * minLogT + intercept },
      { x: maxLogT, y: slope * maxLogT + intercept }
    ];

    const logLogTrace = {
      x: logLogData.map(d => d.logT),
      y: logLogData.map(d => d.logNK),
      type: 'scatter',
      mode: 'markers+text',
      marker: {
        size: 14,
        color: logLogData.map(d => d.week),
        colorscale: 'Viridis',
        showscale: true,
        colorbar: {
          title: 'Week',
          titleside: 'right',
          tickmode: 'array',
          tickvals: [2, 3, 4, 5]
        }
      },
      text: logLogData.map(d => 'Week ' + d.week),
      textposition: 'top center',
      textfont: {
        size: 10,
        color: '#333'
      },
      hovertemplate: '<b>%{customdata[3]}</b><br>log(T): %{x:.3f} (T=%{customdata[0]} days)<br>log(NK): %{y:.3f} (NK=%{customdata[1]:.0f})<br>NK/T: %{customdata[2]:.1f}<extra></extra>',
      customdata: logLogData.map(d => [d.T, d.NK, d.NK / d.T, d.period]),
      name: 'Weeks'
    };

    const trendTrace = {
      x: trendLine.map(d => d.x),
      y: trendLine.map(d => d.y),
      type: 'scatter',
      mode: 'lines',
      line: { color: '#FF5722', width: 2, dash: 'dash' },
      name: \`Trend (slope: \${slope.toFixed(3)})\`,
      hovertemplate: 'Trend line<br>Slope: ' + slope.toFixed(3) + '<extra></extra>'
    };

    Plotly.newPlot('logNKvsLogTChart', [logLogTrace, trendTrace], {
      ...commonLayout,
      title: '📈 Scaling Analysis: log(NK) vs log(T) with Trend',
      xaxis: {
        title: 'log(T) - Cycle Time (log days)',
        gridcolor: '#e0e0e0'
      },
      yaxis: {
        title: 'log(NK) - Parallel Work Capacity',
        gridcolor: '#e0e0e0'
      },
      annotations: [{
        text: \`Slope = \${slope.toFixed(3)}<br>Scaling: NK ∝ T<sup>\${slope.toFixed(2)}</sup><br>\${slope > 1 ? 'Super-linear' : slope > 0.8 ? 'Linear' : slope > 0 ? 'Sub-linear' : 'Negative'} scaling\`,
        xref: 'paper',
        yref: 'paper',
        x: 0.02,
        y: 0.98,
        xanchor: 'left',
        yanchor: 'top',
        showarrow: false,
        font: { size: 11, color: '#666' },
        bgcolor: 'rgba(255,255,255,0.8)',
        borderpad: 4
      }, {
        text: \`Slope indicates how parallel work capacity scales with cycle time.<br>\${slope > 1 ? 'Slope > 1: Increasing cycle time leads to proportionally greater parallel work capacity.' : slope > 0.8 ? 'Slope ≈ 1: Linear relationship - parallel work scales proportionally with cycle time.' : 'Slope < 1: Diminishing returns - longer cycles show less proportional increase in parallel work.'}\`,
        xref: 'paper',
        yref: 'paper',
        x: 0.5,
        y: -0.22,
        xanchor: 'center',
        yanchor: 'top',
        showarrow: false,
        font: { size: 10, color: '#666', style: 'italic' },
        bgcolor: 'rgba(255,255,255,0.9)',
        borderpad: 6
      }],
      showlegend: true,
      legend: {
        x: 0.98,
        y: 0.02,
        xanchor: 'right',
        yanchor: 'bottom',
        bgcolor: 'rgba(255,255,255,0.8)',
        bordercolor: '#e0e0e0',
        borderwidth: 1
      },
      height: 400,
    }, { responsive: true });

    // 2a. Cost Breakdown by Model (Pie Chart)
    const costModelTrace = {
      labels: ['Claude Sonnet 4.5', 'Claude Haiku'],
      values: [1246.41, 15.78],
      type: 'pie',
      marker: {
        colors: ['#2196F3', '#4CAF50']
      },
      textinfo: 'label+percent',
      textposition: 'inside',
      insidetextorientation: 'radial',
      hovertemplate: '<b>%{label}</b><br>Cost: $%{value:.2f}<br>%{percent}<extra></extra>'
    };

    Plotly.newPlot('costModelChart', [costModelTrace], {
      ...commonLayout,
      title: {
        text: 'Cost by Model (Weeks 1-6)',
        y: 0.95
      },
      showlegend: true,
      height: 450,
      margin: { l: 40, r: 40, t: 80, b: 40 }
    }, { responsive: true });

    // 2b. Cost Breakdown by Category (Pie Chart with Infrastructure Breakdown)
    const infraBreakdown = 'Key Management: $7.85 (32.6%)<br>Security Hub: $7.20 (29.9%)<br>CloudWatch: $2.78 (11.5%)<br>Config: $2.60 (10.8%)<br>Tax: $2.75 (11.4%)<br>Other: $0.90 (3.7%)';

    const costCategoryTrace = {
      labels: ['Claude API', 'Infrastructure'],
      values: [1262.19, 24.07],
      type: 'pie',
      marker: {
        colors: ['#2196F3', '#FF9800']
      },
      textinfo: 'label+percent',
      textposition: 'inside',
      insidetextorientation: 'radial',
      customdata: [
        ['Sonnet 4.5: $1246.41 (98.7%)<br>Haiku: $15.78 (1.3%)'],
        [infraBreakdown]
      ],
      hovertemplate: '<b>%{label}</b><br>Cost: $%{value:.2f}<br>%{percent}<br><br>Breakdown:<br>%{customdata[0]}<extra></extra>'
    };

    Plotly.newPlot('costCategoryChart', [costCategoryTrace], {
      ...commonLayout,
      title: {
        text: 'Cost by Category (Weeks 1-6)',
        y: 0.95
      },
      showlegend: true,
      height: 450,
      margin: { l: 40, r: 40, t: 80, b: 40 }
    }, { responsive: true });

    // 2c. Tokens per Story Point (Week 6 only - Week 5 has minimal data)
    const tokensPerSPTrace = {
      x: allWeeks.map(d => d.period),
      y: allWeeks.map((d, idx) => idx === allWeeks.length - 1 ? d.tokensPerSP : null), // Only plot Week 6
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#9C27B0', width: 3 },
      marker: { size: 10 },
      connectgaps: false,
      hovertemplate: '<b>%{x}</b><br>Tokens/SP: %{y:,.0f}<extra></extra>'
    };
    Plotly.newPlot('tokensPerSPChart', [tokensPerSPTrace], {
      ...commonLayout,
      title: 'Tokens per Story Point (Token Tracking Started Week 6)',
      xaxis: { title: 'Week' },
      yaxis: { title: 'Tokens per SP', gridcolor: '#e0e0e0', rangemode: 'tozero' },
      height: 350
    }, { responsive: true });

    // 2d. LOC per Token (Token Tracking Started Week 6)
    const locPerTokenTrace = {
      x: allWeeks.map(d => d.period),
      y: allWeeks.map((d, idx) => idx === allWeeks.length - 1 ? d.locPerToken : null), // Only plot Week 6
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#FF5722', width: 3 },
      marker: { size: 10 },
      connectgaps: false,
      hovertemplate: '<b>%{x}</b><br>LOC/Token: %{y:.4f}<extra></extra>'
    };
    Plotly.newPlot('locPerTokenChart', [locPerTokenTrace], {
      ...commonLayout,
      title: 'Lines of Code per Token (Token Tracking Started Week 6)',
      xaxis: { title: 'Week' },
      yaxis: { title: 'LOC per Token', gridcolor: '#e0e0e0', rangemode: 'tozero' },
      height: 350
    }, { responsive: true });

    // 2e. LOC per Developer
    const locPerDevTrace = {
      x: allWeeks.map(d => d.period),
      y: allWeeks.map(d => d.locPerDev),
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#009688', width: 3 },
      marker: { size: 10 },
      connectgaps: false,
      hovertemplate: '<b>%{x}</b><br>LOC/Dev: %{y:.0f}<extra></extra>'
    };
    Plotly.newPlot('locPerDevChart', [locPerDevTrace], {
      ...commonLayout,
      title: 'Lines of Code per Developer',
      xaxis: { title: 'Week' },
      yaxis: { title: 'LOC per Developer', gridcolor: '#e0e0e0', rangemode: 'tozero' },
      height: 350
    }, { responsive: true });

    // 2f. Tokens per Time to Pass PR (Token Tracking Started Week 6)
    const tokensPerPRTimeTrace = {
      x: allWeeks.map(d => d.period),
      y: allWeeks.map((d, idx) => idx === allWeeks.length - 1 ? d.tokensPerCycleTime : null), // Only plot Week 6
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#00BCD4', width: 3 },
      marker: { size: 10 },
      connectgaps: false,
      hovertemplate: '<b>%{x}</b><br>Tokens/Day: %{y:,.0f}<extra></extra>'
    };
    Plotly.newPlot('tokensPerPRTimeChart', [tokensPerPRTimeTrace], {
      ...commonLayout,
      title: 'Tokens per Time to Pass PR (Token Tracking Started Week 6)',
      xaxis: { title: 'Week' },
      yaxis: { title: 'Tokens per Day', gridcolor: '#e0e0e0', rangemode: 'tozero' },
      height: 350
    }, { responsive: true });

    // 2f2. Tokens per Ticket Scatter Plot (by Story Point Size)
    const ticketTokenData = [{"ticket":"VIBE-216","sp":8,"tokens":1099847,"prNumber":99,"title":"VIBE-216 Civil and Family Daily Cause List","branch":"vibe-516-civil-and-family-daily-cause-list","mergedAt":"2025-11-20T16:33:13Z","createdAt":"2025-11-13T16:36:24Z","week":"Week 6"},{"ticket":"VIBE-140","sp":8,"tokens":332337,"prNumber":92,"title":"VIBE-140 CFT IDAM Integration","branch":"vibe-140-cft-idam-integration","mergedAt":"2025-11-17T09:14:54Z","createdAt":"2025-11-11T11:07:43Z","week":"Week 6"}];

    // Group tickets by story point size
    const spGroups = {};
    ticketTokenData.forEach(ticket => {
      if (!spGroups[ticket.sp]) {
        spGroups[ticket.sp] = [];
      }
      spGroups[ticket.sp].push(ticket);
    });

    // Create a trace for each story point size
    const colors = {
      1: '#4CAF50',
      2: '#2196F3',
      3: '#FF9800',
      5: '#9C27B0',
      8: '#F44336',
      13: '#795548'
    };

    const allWeekNames = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'];

    // Flatten to handle multiple tickets per week per SP size
    const scatterTraces = [];
    Object.keys(spGroups).sort((a, b) => Number(a) - Number(b)).forEach(sp => {
      const tickets = spGroups[sp];

      // For each ticket, create individual data points
      tickets.forEach(ticket => {
        scatterTraces.push({
          x: [ticket.week],
          y: [ticket.tokens],
          type: 'scatter',
          mode: 'markers',
          name: sp + ' SP',
          legendgroup: sp + ' SP',
          showlegend: scatterTraces.filter(t => t.legendgroup === sp + ' SP').length === 0,
          marker: {
            size: 10,
            color: colors[sp] || '#607D8B',
            line: { width: 1, color: '#fff' }
          },
          text: [ticket.ticket + ': ' + ticket.title],
          hovertemplate: '<b>%{text}</b><br>Week: %{x}<br>Tokens: %{y:,.0f}<extra></extra>'
        });
      });
    });

    // Add invisible dummy trace to force all weeks to show on X-axis
    scatterTraces.push({
      x: allWeekNames,
      y: allWeekNames.map(() => null),
      type: 'scatter',
      mode: 'markers',
      showlegend: false,
      hoverinfo: 'skip'
    });

    // Always render chart, even if empty
    if (scatterTraces.length > 0) {
      Plotly.newPlot('tokensPerTicketScatterChart', scatterTraces, {
        ...commonLayout,
        title: 'Tokens per Ticket by Story Point Size',
        xaxis: {
          title: 'Week',
          type: 'category',
          categoryarray: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6']
        },
        yaxis: {
          title: 'Tokens Used',
          gridcolor: '#e0e0e0',
          rangemode: 'tozero'
        },
        height: 400,
        showlegend: true,
        legend: { x: 0.02, y: 0.98, bgcolor: 'rgba(255,255,255,0.9)' }
      }, { responsive: true });
    } else {
      // Show placeholder when no data
      Plotly.newPlot('tokensPerTicketScatterChart', [], {
        ...commonLayout,
        title: 'Tokens per Ticket by Story Point Size',
        xaxis: {
          title: 'Week',
          type: 'category',
          categoryarray: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6']
        },
        yaxis: { title: 'Tokens Used', gridcolor: '#e0e0e0' },
        height: 400,
        annotations: [{
          text: 'No ticket data available yet.<br>Tokens will appear here once PRs with story points are merged.',
          xref: 'paper',
          yref: 'paper',
          x: 0.5,
          y: 0.5,
          showarrow: false,
          font: { size: 14, color: '#666' }
        }]
      }, { responsive: true });
    }

    // 2g. Time to Hit Context Window (Token Tracking Started Week 6)
    const contextWindowTimeTrace = {
      x: allWeeks.map(d => d.period),
      y: allWeeks.map((d, idx) => idx === allWeeks.length - 1 ? d.timeToContextWindow : null), // Only plot Week 6
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#E91E63', width: 3 },
      marker: { size: 10 },
      connectgaps: false,
      hovertemplate: '<b>%{x}</b><br>Time to Context Window: %{y} min<extra></extra>'
    };
    Plotly.newPlot('contextWindowTimeChart', [contextWindowTimeTrace], {
      ...commonLayout,
      title: 'Time to Hit Context Window (Token Tracking Started Week 6)',
      xaxis: { title: 'Week' },
      yaxis: { title: 'Minutes', gridcolor: '#e0e0e0', rangemode: 'tozero' },
      height: 350
    }, { responsive: true });

    // 2g. Auto-Compactions vs Manual Compactions
    const autoCompactionsTrace = {
      x: allWeeks.map(d => d.period),
      y: allWeeks.map(d => d.autoCompactions),
      type: 'bar',
      name: 'Auto Compactions',
      marker: { color: '#4CAF50' },
      hovertemplate: '<b>%{x}</b><br>Auto: %{y}<extra></extra>'
    };

    const manualCompactionsTrace = {
      x: allWeeks.map(d => d.period),
      y: allWeeks.map(d => d.manualCompactions),
      type: 'bar',
      name: 'Manual Compactions',
      marker: { color: '#FF9800' },
      hovertemplate: '<b>%{x}</b><br>Manual: %{y}<extra></extra>'
    };

    Plotly.newPlot('compactionsChart', [autoCompactionsTrace, manualCompactionsTrace], {
      ...commonLayout,
      title: 'Auto-Compactions vs Manual Compactions',
      xaxis: { title: 'Week' },
      yaxis: { title: 'Count', gridcolor: '#e0e0e0', rangemode: 'tozero' },
      barmode: 'group',
      height: 350,
      showlegend: true
    }, { responsive: true });

    // 3. Number of Feature PRs
    createSimpleChart('featurePRsChart', allWeeks.map(d => d.featurePRs), 'Number of Feature PRs', 'Feature PRs', '#4CAF50');

    // 3. LOC per PR
    createSimpleChart('locPerPRChart', allWeeks.map(d => d.locPerPR), 'LOC per PR', 'Lines of Code per PR', '#FF9800');

    // 4. Comments per PR
    createSimpleChart('commentsChart', allWeeks.map(d => d.commentsPerPR), 'Comments per PR', 'Comments per PR', '#9C27B0');

    // 5. Test Coverage
    createSimpleChart('testCoverageChart', allWeeks.map(d => d.testCoverage), 'Average Test Coverage per PR', 'Test Coverage (%)', '#4CAF50');

    // 6. CVEs - Custom chart with integer y-axis from 0-5
    const cvesTrace = {
      x: allWeeks.map(d => d.period),
      y: allWeeks.map(d => d.cves),
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#f44336', width: 3 },
      marker: { size: 10, color: '#f44336' },
      connectgaps: false,
      hovertemplate: '<b>%{x}</b><br>CVEs: %{y}<extra></extra>'
    };
    Plotly.newPlot('cvesChart', [cvesTrace], {
      ...commonLayout,
      title: 'CVEs (Vulnerabilities)',
      xaxis: { title: 'Week' },
      yaxis: {
        title: 'CVEs',
        gridcolor: '#e0e0e0',
        tick0: 0,
        dtick: 1, // Increment by 1
        range: [0, 5] // Fixed range 0-5
      },
      height: 350,
    }, { responsive: true });

    // 7. Duplicated Lines - Integer values only
    const duplicatedLinesTrace = {
      x: allWeeks.map(d => d.period),
      y: allWeeks.map(d => d.duplicatedLines),
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#FF5722', width: 3 },
      marker: { size: 10, color: '#FF5722' },
      connectgaps: false,
      hovertemplate: '<b>%{x}</b><br>Duplicated Lines: %{y:.0f}%<extra></extra>'
    };
    Plotly.newPlot('duplicatedLinesChart', [duplicatedLinesTrace], {
      ...commonLayout,
      title: 'Duplicated Lines',
      xaxis: { title: 'Week' },
      yaxis: {
        title: 'Duplicated Lines (%)',
        gridcolor: '#e0e0e0',
        rangemode: 'tozero',
        range: [0, null]
      },
      height: 350,
    }, { responsive: true });

    // 8. Maintainability - Custom chart with inverted rating scale (A at top)
    const maintainabilityTrace = {
      x: allWeeks.map(d => d.period),
      y: allWeeks.map(d => d.maintainability),
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#4CAF50', width: 3 },
      marker: { size: 10, color: '#4CAF50' },
      connectgaps: false,
      hovertemplate: '<b>%{x}</b><br>Maintainability: %{y:.1f} (A)<extra></extra>'
    };
    Plotly.newPlot('maintainabilityChart', [maintainabilityTrace], {
      ...commonLayout,
      title: 'Maintainability Rating',
      xaxis: { title: 'Week' },
      yaxis: {
        title: 'Rating',
        gridcolor: '#e0e0e0',
        range: [5.5, 0.5], // Inverted: A (1.0) at top, E (5.0) at bottom
        tickmode: 'array',
        tickvals: [1, 2, 3, 4, 5],
        ticktext: ['A (1.0)', 'B (2.0)', 'C (3.0)', 'D (4.0)', 'E (5.0)']
      },
      height: 350,
    }, { responsive: true });

    // 9. Reliability - Custom chart with inverted rating scale (A at top)
    const reliabilityTrace = {
      x: allWeeks.map(d => d.period),
      y: allWeeks.map(d => d.reliability),
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#2196F3', width: 3 },
      marker: { size: 10, color: '#2196F3' },
      connectgaps: false,
      hovertemplate: '<b>%{x}</b><br>Reliability: %{y:.1f} (A)<extra></extra>'
    };
    Plotly.newPlot('reliabilityChart', [reliabilityTrace], {
      ...commonLayout,
      title: 'Reliability Rating',
      xaxis: { title: 'Week' },
      yaxis: {
        title: 'Rating',
        gridcolor: '#e0e0e0',
        range: [5.5, 0.5], // Inverted: A (1.0) at top, E (5.0) at bottom
        tickmode: 'array',
        tickvals: [1, 2, 3, 4, 5],
        ticktext: ['A (1.0)', 'B (2.0)', 'C (3.0)', 'D (4.0)', 'E (5.0)']
      },
      height: 350,
    }, { responsive: true });

    // 10. Security - Custom chart with inverted rating scale (A at top)
    const securityTrace = {
      x: allWeeks.map(d => d.period),
      y: allWeeks.map(d => d.security),
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#FF9800', width: 3 },
      marker: { size: 10, color: '#FF9800' },
      connectgaps: false,
      hovertemplate: '<b>%{x}</b><br>Security: %{y:.1f} (A)<extra></extra>'
    };
    Plotly.newPlot('securityChart', [securityTrace], {
      ...commonLayout,
      title: 'Security Rating',
      xaxis: { title: 'Week' },
      yaxis: {
        title: 'Rating',
        gridcolor: '#e0e0e0',
        range: [5.5, 0.5], // Inverted: A (1.0) at top, E (5.0) at bottom
        tickmode: 'array',
        tickvals: [1, 2, 3, 4, 5],
        ticktext: ['A (1.0)', 'B (2.0)', 'C (3.0)', 'D (4.0)', 'E (5.0)']
      },
      height: 350,
    }, { responsive: true });

    // 11. Code Smells
    createSimpleChart('codeSmellsChart', allWeeks.map(d => d.codeSmells), 'Code Smells per PR', 'Code Smells', '#FF5722');

    // 12. Cost per LOC
    const costLOCTrace = {
      x: allWeeks.map(d => d.period),
      y: allWeeks.map(d => d.costPerLOC),
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#9C27B0', width: 3 },
      marker: { size: 10 },
      connectgaps: false,
      hovertemplate: '<b>%{x}</b><br>Cost per LOC: $%{y:.4f}<extra></extra>'
    };
    Plotly.newPlot('costPerLOCChart', [costLOCTrace], {
      ...commonLayout,
      title: 'Cost per LOC',
      xaxis: { title: 'Week' },
      yaxis: {
        title: 'Cost per LOC ($)',
        gridcolor: '#e0e0e0',
        rangemode: 'tozero',
        range: [0, null]
      },
      height: 350,
    }, { responsive: true });

    // 13. Cost per PR
    const costPRTrace = {
      x: allWeeks.map(d => d.period),
      y: allWeeks.map(d => d.costPerPR),
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#FF9800', width: 3 },
      marker: { size: 10 },
      connectgaps: false,
      hovertemplate: '<b>%{x}</b><br>Cost per PR: $%{y:.2f}<extra></extra>'
    };
    Plotly.newPlot('costPerPRChart', [costPRTrace], {
      ...commonLayout,
      title: 'Cost per Feature PR',
      xaxis: { title: 'Week' },
      yaxis: {
        title: 'Cost per PR ($)',
        gridcolor: '#e0e0e0',
        rangemode: 'tozero',
        range: [0, null]
      },
      height: 350,
    }, { responsive: true });

    // 14. Story Points Completed
    createSimpleChart('storyPointsChart', allWeeks.map(d => d.storyPoints), 'Story Points Completed', 'Story Points', '#4CAF50');

    // 15. Prompt Categories Breakdown (Stacked Bar Chart)
    const categoryColors = {
      feature_development: '#4CAF50',
      bug_fix: '#FF5722',
      general: '#9E9E9E',
      code_understanding: '#2196F3',
      testing: '#FF9800',
      refactoring: '#9C27B0',
      documentation: '#00BCD4',
      code_review: '#607D8B',
      version_control: '#795548',
      configuration: '#E91E63'
    };
    const categoryLabels = {
      feature_development: 'Feature Development',
      bug_fix: 'Bug Fix',
      general: 'General',
      code_understanding: 'Code Understanding',
      testing: 'Testing',
      refactoring: 'Refactoring',
      documentation: 'Documentation',
      code_review: 'Code Review',
      version_control: 'Version Control',
      configuration: 'Configuration'
    };

    // Collect all categories across all weeks and sum their counts
    const categoryCounts = {};
    allWeeks.forEach(d => {
      if (d.promptCategories) {
        Object.keys(d.promptCategories).forEach(category => {
          if (!categoryCounts[category]) {
            categoryCounts[category] = 0;
          }
          categoryCounts[category] += d.promptCategories[category].count || 0;
        });
      }
    });

    // Sort categories by total count (descending) - largest first for bottom of stack
    const sortedCategories = Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a]);

    const categoryTraces = sortedCategories.map(category => {
      return {
        x: allWeeks.map(d => d.period),
        y: allWeeks.map((d, idx) => {
          // Only plot Week 6 (last week with substantial prompt data)
          if (idx !== allWeeks.length - 1) return null;
          if (!d.promptCategories || !d.promptCategories[category]) return null;
          return d.promptCategories[category].count || null;
        }),
        name: categoryLabels[category] || category,
        type: 'bar',
        marker: { color: categoryColors[category] || '#999999' },
        hovertemplate: '<b>%{x}</b><br>' + (categoryLabels[category] || category) + ': %{y}<extra></extra>'
      };
    });

    Plotly.newPlot('promptCategoriesChart', categoryTraces, {
      ...commonLayout,
      title: 'Prompt Categories Breakdown by Week (Token Tracking Started Week 6)',
      xaxis: { title: 'Week' },
      yaxis: {
        title: 'Number of Prompts',
        gridcolor: '#e0e0e0',
        rangemode: 'tozero'
      },
      barmode: 'stack',
      height: 400,
      margin: { l: 60, r: 30, t: 80, b: 80 },
      showlegend: true,
      legend: {
        orientation: 'h',
        yanchor: 'bottom',
        y: 1.02,
        xanchor: 'right',
        x: 1
      }
    }, { responsive: true });

    // 19. Cost per Story Point
    const costSPTrace = {
      x: allWeeks.map(d => d.period),
      y: allWeeks.map(d => d.costPerSP),
      type: 'scatter',
      mode: 'lines+markers',
      line: { color: '#2196F3', width: 3 },
      marker: { size: 10 },
      connectgaps: false,
      hovertemplate: '<b>%{x}</b><br>Cost per SP: $%{y:.2f}<extra></extra>'
    };
    Plotly.newPlot('costPerSPChart', [costSPTrace], {
      ...commonLayout,
      title: 'Average Cost per Completed Story Point',
      xaxis: { title: 'Week' },
      yaxis: {
        title: 'Cost per Story Point ($)',
        gridcolor: '#e0e0e0',
        rangemode: 'tozero',
        range: [0, null]
      },
      height: 350,
    }, { responsive: true });

  </script>
</body>
</html>`;

// Write HTML file
const outputPath = path.resolve(__dirname, outputFile);
fs.writeFileSync(outputPath, html);

console.log(`✅ Weekly metrics report generated: ${outputPath}`);
console.log(`   Open in browser: file://${outputPath}`);
console.log();
