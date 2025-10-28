// ==UserScript==
// @name         FreeBitco.in Fibonacci Auto-Bet
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Automate bets with Fibonacci progression on FreeBitco.in "BET HI"
// @author       you
// @match        https://freebitco.in/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log('Fibonacci Auto-Bet script loaded');

    // --- Configurable base amount & selectors ---
    let baseAmount = 0.00000001;
    let isRunning = false;
    let fibSeq = [baseAmount, baseAmount];
    let currentStep = 0;

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

        controller.innerHTML = `
            <label>
                Starting Amount:
                <input type="text" id="fib_base_amount" value="${baseAmount.toFixed(8)}" style="width:110px;">
            </label><br>
            <button id="fib_start" style="background:#4CAF50;color:white;border:none;padding:8px 12px;margin-top:8px;cursor:pointer;border-radius:3px;">Start Auto-Bet</button>
            <button id="fib_stop" disabled style="background:#f44336;color:white;border:none;padding:8px 12px;margin-top:8px;margin-left:5px;cursor:pointer;opacity:0.5;border-radius:3px;">Stop</button>
            <div id="fib_status" style="margin-top:6px;color:#888;">Stopped</div>
        `;

        document.body.appendChild(controller);
        console.log('UI injected successfully');

        document.getElementById('fib_base_amount').addEventListener('change', function(){
            baseAmount = parseFloat(this.value);
            fibSeq = [baseAmount, baseAmount];
            currentStep = 0;
        });
        document.getElementById('fib_start').addEventListener('click', startAutoBet);
        document.getElementById('fib_stop').addEventListener('click', stopAutoBet);
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
        if (balance < betAmount) {
            console.log(`Insufficient balance: ${balance.toFixed(8)} < ${betAmount.toFixed(8)}`);
            setStatus(`Stopped - Insufficient balance`);
            stopAutoBet();
            return false;
        }
        return true;
    }

    // --- Main Logic ---
    let betInProgress = false;
    let resultObserver = null;

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
        setStatus(`Betting ${amount.toFixed(8)}`);
        console.log('Placed bet:', amount.toFixed(8), '| Balance:', getBalance().toFixed(8));
    }

    function handleWin() {
        if (!isRunning || !betInProgress) return;

        console.log('WIN - Resetting to base amount:', baseAmount.toFixed(8));
        setStatus('Win! Resetting...');
        resetFib();
        betInProgress = false;

        setTimeout(() => {
            if (isRunning) placeBet(baseAmount);
        }, 500);
    }

    function handleLoss() {
        if (!isRunning || !betInProgress) return;

        let previous = fibSeq[fibSeq.length-1];
        let next = nextFibStep();
        let increase = next - previous;
        console.log('LOSS - Increasing bet by:', increase.toFixed(8), '| Next bet:', next.toFixed(8));
        setStatus(`Loss. Next bet: ${next.toFixed(8)}`);
        betInProgress = false;

        setTimeout(() => {
            if (isRunning) placeBet(next);
        }, 500);
    }

    function setupResultObserver() {
        let winDiv = document.getElementById('double_your_btc_bet_win');
        let loseDiv = document.getElementById('double_your_btc_bet_lose');

        if (!winDiv || !loseDiv) {
            console.error('Win/Loss divs not found');
            return;
        }

        // Observe changes to both win and lose divs
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
                        }
                    }
                }
            });
        });

        // Observe both divs for style attribute changes
        resultObserver.observe(winDiv, { attributes: true, attributeFilter: ['style'] });
        resultObserver.observe(loseDiv, { attributes: true, attributeFilter: ['style'] });

        console.log('Result observer setup complete');
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

        if (document.getElementById('fib_status').innerText.indexOf('Insufficient') === -1) {
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

    // --- Multiple injection attempts for reliability ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectUI);
    } else {
        injectUI();
    }

    window.addEventListener('load', function() {
        setTimeout(injectUI, 500);
    });

})();
