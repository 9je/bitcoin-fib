// ==UserScript==
// @name         FreeBitco.in Fibonacci Auto-Bet
// @namespace    http://tampermonkey.net/
// @version      2.3
// @description  Automate bets with Fibonacci progression on FreeBitco.in "BET HI"
// @author       you
// @match        https://freebitco.in/*
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js
// ==/UserScript==

(function() {
    'use strict';

    console.log('Fibonacci Auto-Bet script loaded');

    // --- Configurable base amount & selectors ---
    let baseAmount = 0.00000001;
    let stopBalance = 0.0003;
    let stopBalanceEnabled = false;
    let stopOperator = '>'; // '<' or '>'
    let isRunning = false;
    let fibSeq = [baseAmount, baseAmount];
    let currentStep = 0;

    // Chart data
    let balanceChart = null;
    let chartData = [];
    let betCounter = 0;

    // Profit tracking
    let startingBalance = 0;

    // --- UI Elements ---
    function injectUI() {
        console.log('Injecting UI...');

        // Remove old controller if exists
        let oldController = document.getElementById('fibAutobetController');
        if (oldController) {
            oldController.remove();
        }

        const controller = document.createElement('div');
        controller.id = "fibAutobetController";
        controller.style.padding = "10px";
        controller.style.background = "#fff";
        controller.style.border = "2px solid #333";
        controller.style.position = "fixed";
        controller.style.top = "100px";
        controller.style.right = "10px";
        controller.style.zIndex = "9999";
        controller.style.borderRadius = "5px";
        controller.style.boxShadow = "0 2px 10px rgba(0,0,0,0.3)";
        controller.style.minWidth = "320px";
        controller.style.maxWidth = "400px";

        controller.innerHTML = `
            <div style="margin-bottom:8px;">
                <label>
                    Starting Amount:
                    <input type="text" id="fib_base_amount" value="${baseAmount.toFixed(8)}" style="width:110px;">
                </label>
            </div>

            <div style="margin-bottom:8px;padding:8px;background:#f0f0f0;border-radius:3px;">
                <label style="display:block;margin-bottom:4px;">
                    <input type="checkbox" id="fib_stop_balance_enabled" style="margin-right:4px;">
                    Stop when balance:
                </label>
                <div style="display:flex;gap:4px;align-items:center;">
                    <select id="fib_stop_operator" style="padding:4px;" disabled>
                        <option value="<">&lt; (less than)</option>
                        <option value=">" selected>&gt; (greater than)</option>
                    </select>
                </div>
                <input type="text" id="fib_stop_balance" value="${stopBalance.toFixed(8)}" style="width:110px;margin-top:4px;" disabled>
            </div>

            <button id="fib_start" style="background:#4CAF50;color:white;border:none;padding:8px 12px;cursor:pointer;border-radius:3px;width:48%;">Start</button>
            <button id="fib_stop" disabled style="background:#f44336;color:white;border:none;padding:8px 12px;cursor:pointer;opacity:0.5;border-radius:3px;width:48%;">Stop</button>
            <div id="fib_status" style="margin-top:6px;color:#888;font-size:12px;">Stopped</div>

            <div style="margin-top:10px;padding:8px;background:#f9f9f9;border-radius:3px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:6px;align-items:center;">
                    <strong style="font-size:11px;">Balance Chart (<span id="fib_point_count">0</span> bets)</strong>
                    <button id="fib_clear_chart" style="font-size:10px;padding:2px 6px;background:#666;color:white;border:none;border-radius:2px;cursor:pointer;">Clear</button>
                </div>
                <canvas id="fib_balance_chart" width="280" height="140"></canvas>

                <div id="fib_profit_tracker" style="margin-top:10px;padding:8px;background:#fff;border-radius:3px;border:1px solid #ddd;text-align:center;">
                    <div style="font-size:10px;color:#666;margin-bottom:2px;">Session Profit/Loss</div>
                    <div id="fib_profit_value" style="font-size:16px;font-weight:bold;color:#666;">-</div>
                    <div id="fib_profit_percent" style="font-size:11px;color:#666;margin-top:2px;">-</div>
                </div>
            </div>
        `;

        document.body.appendChild(controller);
        console.log('UI injected successfully');

        // Event listeners
        document.getElementById('fib_base_amount').addEventListener('change', function(){
            baseAmount = parseFloat(this.value);
            fibSeq = [baseAmount, baseAmount];
            currentStep = 0;
        });

        document.getElementById('fib_stop_balance_enabled').addEventListener('change', function(){
            stopBalanceEnabled = this.checked;
            document.getElementById('fib_stop_balance').disabled = !this.checked;
            document.getElementById('fib_stop_operator').disabled = !this.checked;
        });

        document.getElementById('fib_stop_balance').addEventListener('change', function(){
            stopBalance = parseFloat(this.value) || 0;
        });

        document.getElementById('fib_stop_operator').addEventListener('change', function(){
            stopOperator = this.value;
        });

        document.getElementById('fib_start').addEventListener('click', startAutoBet);
        document.getElementById('fib_stop').addEventListener('click', stopAutoBet);
        document.getElementById('fib_clear_chart').addEventListener('click', clearChart);

        // Initialize chart
        initChart();
    }

    // --- Chart Functions ---
    function initChart() {
        const ctx = document.getElementById('fib_balance_chart');
        if (!ctx) return;

        balanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Balance',
                    data: chartData,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.1)',
                    borderWidth: 1.5,
                    tension: 0,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                animation: false,
                parsing: false,
                normalized: true,
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: 'Bet #',
                            font: { size: 10 }
                        },
                        ticks: {
                            font: { size: 9 },
                            maxTicksLimit: 6,
                            autoSkip: true
                        }
                    },
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: 'Balance (BTC)',
                            font: { size: 10 }
                        },
                        ticks: {
                            font: { size: 9 },
                            callback: function(value) {
                                return value.toFixed(8);
                            }
                        }
                    }
                },
                plugins: {
                    decimation: {
                        enabled: true,
                        algorithm: 'lttb',
                        samples: 200,
                        threshold: 500
                    },
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                return 'Bet #' + Math.round(context[0].parsed.x);
                            },
                            label: function(context) {
                                return 'Balance: ' + context.parsed.y.toFixed(8) + ' BTC';
                            }
                        }
                    }
                }
            }
        });
    }

    function updateChart(balance) {
        if (!balanceChart) return;

        betCounter++;

        // Add data point
        chartData.push({
            x: betCounter,
            y: balance
        });

        // Update point count
        document.getElementById('fib_point_count').textContent = chartData.length;

        // Update profit tracker
        updateProfitTracker(balance);

        // Update chart
        balanceChart.update('none');
    }

    function updateProfitTracker(currentBalance) {
        let profit = currentBalance - startingBalance;
        let profitPercent = startingBalance > 0 ? (profit / startingBalance) * 100 : 0;

        let valueElement = document.getElementById('fib_profit_value');
        let percentElement = document.getElementById('fib_profit_percent');

        // Format profit value
        let profitText = (profit >= 0 ? '+' : '') + profit.toFixed(8) + ' BTC';
        valueElement.textContent = profitText;

        // Format percentage
        let percentText = '(' + (profitPercent >= 0 ? '+' : '') + profitPercent.toFixed(2) + '%)';
        percentElement.textContent = percentText;

        // Color based on profit/loss
        if (profit > 0) {
            valueElement.style.color = '#4CAF50'; // Green
            percentElement.style.color = '#4CAF50';
        } else if (profit < 0) {
            valueElement.style.color = '#f44336'; // Red
            percentElement.style.color = '#f44336';
        } else {
            valueElement.style.color = '#666'; // Gray
            percentElement.style.color = '#666';
        }
    }

    function clearChart() {
        chartData.length = 0;
        betCounter = 0;
        if (balanceChart) {
            balanceChart.update('none');
            document.getElementById('fib_point_count').textContent = '0';
        }

        // Reset profit tracker
        startingBalance = getBalance();
        updateProfitTracker(startingBalance);

        console.log('Chart cleared');
    }

    // --- Fibonacci Helpers ---
    function nextFibStep() {
        if (fibSeq.length < 2) fibSeq = [baseAmount, baseAmount];
        let next = fibSeq[fibSeq.length-1] + fibSeq[fibSeq.length-2];
        fibSeq.push(next);
        currentStep++;
        return next;
    }
    function resetFib() {
        fibSeq = [baseAmount, baseAmount];
        currentStep = 0;
    }

    // --- Balance Check ---
    function getBalance() {
        let balanceElement = document.getElementById('balance');
        if (balanceElement) {
            return parseFloat(balanceElement.textContent) || 0;
        }
        return 0;
    }

    function checkBalance(betAmount) {
        let balance = getBalance();

        // Check if balance is sufficient for bet
        if (balance < betAmount) {
            console.log(`Insufficient balance for bet: ${balance.toFixed(8)} < ${betAmount.toFixed(8)}`);
            setStatus(`Stopped - Insufficient balance`);
            stopAutoBet();
            return false;
        }

        // Check stop balance condition if enabled
        if (stopBalanceEnabled) {
            let shouldStop = false;
            if (stopOperator === '<' && balance < stopBalance) {
                shouldStop = true;
                console.log(`Stop condition met: balance ${balance.toFixed(8)} < ${stopBalance.toFixed(8)}`);
                setStatus(`Stopped - Balance below ${stopBalance.toFixed(8)}`);
            } else if (stopOperator === '>' && balance > stopBalance) {
                shouldStop = true;
                console.log(`Stop condition met: balance ${balance.toFixed(8)} > ${stopBalance.toFixed(8)}`);
                setStatus(`Stopped - Balance above ${stopBalance.toFixed(8)}`);
            }

            if (shouldStop) {
                stopAutoBet();
                return false;
            }
        }

        return true;
    }

    // --- Main Logic ---
    let betInProgress = false;
    let resultObserver = null;
    let currentBetAmount = 0;

    function placeBet(amount) {
        if (!isRunning) return;

        // Check balance before placing bet
        if (!checkBalance(amount)) {
            return;
        }

        // Set stake input
        let input = document.getElementById('double_your_btc_stake');
        if (!input) {
            console.error('Stake input not found');
            stopAutoBet();
            return;
        }
        input.value = amount.toFixed(8);

        // Simulate click
        let betButton = document.getElementById('double_your_btc_bet_hi_button');
        if (!betButton) {
            console.error('Bet button not found');
            stopAutoBet();
            return;
        }

        betButton.click();
        betInProgress = true;
        currentBetAmount = amount;
        setStatus(`Betting ${amount.toFixed(8)}`);
        console.log('Placed bet:', amount.toFixed(8), '| Balance:', getBalance().toFixed(8));
    }

    function handleWin() {
        if (!isRunning || !betInProgress) return;

        let balance = getBalance();

        console.log('WIN - Resetting to base amount:', baseAmount.toFixed(8));
        setStatus('Win! Resetting...');

        // Update chart with current balance
        updateChart(balance);

        resetFib();
        betInProgress = false;

        setTimeout(() => {
            if (isRunning) placeBet(baseAmount);
        }, 500);
    }

    function handleLoss() {
        if (!isRunning || !betInProgress) return;

        let balance = getBalance();

        let previous = fibSeq[fibSeq.length-1];
        let next = nextFibStep();
        let increase = next - previous;
        console.log('LOSS - Increasing bet by:', increase.toFixed(8), '| Next bet:', next.toFixed(8));
        setStatus(`Loss. Next: ${next.toFixed(8)}`);

        // Update chart with current balance
        updateChart(balance);

        betInProgress = false;

        setTimeout(() => {
            if (isRunning) placeBet(next);
        }, 500);
    }

    function handleError() {
        if (!isRunning || !betInProgress) return;

        console.log('ERROR - Request timed out, retrying same bet:', currentBetAmount.toFixed(8));
        setStatus('Error - Retrying...');
        betInProgress = false;

        // Don't update chart on errors, just retry
        setTimeout(() => {
            if (isRunning) placeBet(currentBetAmount);
        }, 2000);
    }

    function setupResultObserver() {
        let winDiv = document.getElementById('double_your_btc_bet_win');
        let loseDiv = document.getElementById('double_your_btc_bet_lose');
        let errorDiv = document.getElementById('double_your_btc_error');

        if (!winDiv || !loseDiv || !errorDiv) {
            console.error('Win/Loss/Error divs not found');
            return;
        }

        // Observe changes to win, lose, and error divs
        resultObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    let target = mutation.target;

                    // Check if this div just became visible
                    if (target.style.display !== 'none' && window.getComputedStyle(target).display !== 'none') {
                        if (target.id === 'double_your_btc_bet_win') {
                            console.log('Detected WIN via MutationObserver');
                            handleWin();
                        } else if (target.id === 'double_your_btc_bet_lose') {
                            console.log('Detected LOSS via MutationObserver');
                            handleLoss();
                        } else if (target.id === 'double_your_btc_error') {
                            console.log('Detected ERROR via MutationObserver');
                            handleError();
                        }
                    }
                }
            });
        });

        // Observe all three divs for style attribute changes
        resultObserver.observe(winDiv, { attributes: true, attributeFilter: ['style'] });
        resultObserver.observe(loseDiv, { attributes: true, attributeFilter: ['style'] });
        resultObserver.observe(errorDiv, { attributes: true, attributeFilter: ['style'] });

        console.log('Result observer setup complete (including error handling)');
    }

    // --- Control Functions ---
    function startAutoBet() {
        isRunning = true;
        let stopBtn = document.getElementById('fib_stop');
        let startBtn = document.getElementById('fib_start');

        stopBtn.disabled = false;
        stopBtn.style.opacity = '1';
        startBtn.disabled = true;
        startBtn.style.opacity = '0.5';

        setStatus('Running...');
        resetFib();

        // Setup observer before starting
        setupResultObserver();

        // Initialize starting balance and profit tracker
        startingBalance = getBalance();
        updateProfitTracker(startingBalance);

        // Add initial balance to chart
        updateChart(startingBalance);

        // Place first bet after checking balance
        setTimeout(() => {
            placeBet(baseAmount);
        }, 500);
    }

    function stopAutoBet() {
        isRunning = false;
        let startBtn = document.getElementById('fib_start');
        let stopBtn = document.getElementById('fib_stop');

        startBtn.disabled = false;
        startBtn.style.opacity = '1';
        stopBtn.disabled = true;
        stopBtn.style.opacity = '0.5';

        if (document.getElementById('fib_status').innerText.indexOf('Stopped') === -1) {
            setStatus('Stopped');
        }

        // Disconnect observer
        if (resultObserver) {
            resultObserver.disconnect();
            resultObserver = null;
        }

        betInProgress = false;
    }

    function setStatus(msg) {
        let statusDiv = document.getElementById('fib_status');
        if (statusDiv) {
            statusDiv.innerText = msg;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectUI);
    } else {
        injectUI();
    }

    window.addEventListener('load', function() {
        setTimeout(injectUI, 500);
    });

})();
