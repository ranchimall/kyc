
const { html, render: renderElem } = uhtml;
// Use instead of document.getElementById
const domRefs = {};
function getRef(elementId) {
    if (!domRefs.hasOwnProperty(elementId)) {
        domRefs[elementId] = {
            count: 1,
            ref: null,
        };
        return document.getElementById(elementId);
    } else {
        if (domRefs[elementId].count < 3) {
            domRefs[elementId].count = domRefs[elementId].count + 1;
            return document.getElementById(elementId);
        } else {
            if (!domRefs[elementId].ref)
                domRefs[elementId].ref = document.getElementById(elementId);
            return domRefs[elementId].ref;
        }
    }
}
//Function for displaying toast notifications. pass in error for mode param if you want to show an error.
function notify(message, mode, options = {}) {
    let icon
    switch (mode) {
        case 'success':
            icon = `<svg class="icon icon--success" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M10 15.172l9.192-9.193 1.415 1.414L10 18l-6.364-6.364 1.414-1.414z"/></svg>`
            break;
        case 'error':
            icon = `<svg class="icon icon--error" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm0-8v6h2V7h-2z"/></svg>`
            options.pinned = true
            break;
    }
    if (mode === 'error') {
        console.error(message)
    }
    return getRef("notification_drawer").push(message, { icon, ...options });
}
let zIndex = 50
// function required for popups or modals to appear
function openPopup(popupId, pinned) {
    zIndex++
    getRef(popupId).setAttribute('style', `z-index: ${zIndex}`)
    return getRef(popupId).show({ pinned })
}

// hides the popup or modal
function closePopup(options = {}) {
    if (popupStack.peek() === undefined)
        return;
    popupStack.peek().popup.hide(options)
}
// displays a popup for asking permission. Use this instead of JS confirm
const getConfirmation = (title, options = {}) => {
    return new Promise(resolve => {
        const { message = '', cancelText = 'Cancel', confirmText = 'OK', danger = false } = options
        getRef('confirm_title').innerText = title;
        getRef('confirm_message').innerText = message;
        const cancelButton = getRef('confirmation_popup').querySelector('.cancel-button');
        const confirmButton = getRef('confirmation_popup').querySelector('.confirm-button')
        confirmButton.textContent = confirmText
        cancelButton.textContent = cancelText
        if (danger)
            confirmButton.classList.add('button--danger')
        else
            confirmButton.classList.remove('button--danger')
        const { closed } = openPopup('confirmation_popup')
        confirmButton.onclick = () => {
            closePopup({ payload: true })
        }
        cancelButton.onclick = () => {
            closePopup()
        }
        closed.then((payload) => {
            confirmButton.onclick = null
            cancelButton.onclick = null
            if (payload)
                resolve(true)
            else
                resolve(false)
        })
    })
}
function getFormattedTime(timestamp, format) {
    try {
        if (String(timestamp).length < 13)
            timestamp *= 1000
        let [day, month, date, year] = new Date(timestamp).toString().split(' '),
            minutes = new Date(timestamp).getMinutes(),
            hours = new Date(timestamp).getHours(),
            currentTime = new Date().toString().split(' ')

        minutes = minutes < 10 ? `0${minutes}` : minutes
        let finalHours = ``;
        if (hours > 12)
            finalHours = `${hours - 12}:${minutes}`
        else if (hours === 0)
            finalHours = `12:${minutes}`
        else
            finalHours = `${hours}:${minutes}`

        finalHours = hours >= 12 ? `${finalHours} PM` : `${finalHours} AM`
        switch (format) {
            case 'date-only':
                return `${month} ${date}, ${year}`;
                break;
            case 'time-only':
                return finalHours;
            default:
                return `${month} ${date}, ${year} at ${finalHours}`;
        }
    } catch (e) {
        console.error(e);
        return timestamp;
    }
}

class Router {
    constructor(options = {}) {
        const { routes = {}, state = {}, routingStart, routingEnd } = options
        this.routes = routes
        this.state = state
        this.routingStart = routingStart
        this.routingEnd = routingEnd
        window.addEventListener('hashchange', e => this.routeTo(window.location.hash))
    }
    addRoute(route, callback) {
        this.routes[route] = callback
    }
    async routeTo(path) {
        let page
        let wildcards = []
        let queryString
        let params
        [path, queryString] = path.split('?');
        if (path.includes('#'))
            path = path.split('#')[1];
        if (path.includes('/'))
            [, page, ...wildcards] = path.split('/')
        else
            page = path
        this.state = { page, wildcards }
        if (queryString) {
            params = new URLSearchParams(queryString)
            this.state.params = Object.fromEntries(params)
        }
        if (this.routingStart) {
            this.routingStart(this.state)
        }
        if (this.routes[page]) {
            await this.routes[page](this.state)
            this.state.lastPage = page
        } else {
            this.routes['404'](this.state)
        }
        if (this.routingEnd) {
            this.routingEnd(this.state)
        }
    }
}
const router = new Router({
    routingStart(state) {
        loading()
        if ("scrollRestoration" in history) {
            history.scrollRestoration = "manual";
        }
        window.scrollTo(0, 0);
    },
    routingEnd() {
        loading(false)
    }
})
router.addRoute('404', async () => {
    return '404'
})
function loading(show = true) {
    if (show) {
        getRef('loading').classList.remove('hidden')
    } else {
        getRef('loading').classList.add('hidden')
    }
}
function getSignedIn(passwordType) {
    return new Promise((resolve, reject) => {
        try {
            console.log(floDapps.user.id)
            getPromptInput('Enter password', '', {
                isPassword: true,
            }).then(password => {
                if (password) {
                    resolve(password)
                }
            })
        } catch (err) {
            if (passwordType === 'PIN/Password') {
                floGlobals.isPrivKeySecured = true;
                getRef('private_key_field').removeAttribute('data-private-key');
                getRef('private_key_field').setAttribute('placeholder', 'Password');
                getRef('private_key_field').customValidation = null
            } else {
                floGlobals.isPrivKeySecured = false;
                getRef('private_key_field').dataset.privateKey = ''
                getRef('private_key_field').setAttribute('placeholder', 'FLO private key');
                getRef('private_key_field').customValidation = floCrypto.getPubKeyHex;
            }
            if (window.location.hash.includes('sign_in') || window.location.hash.includes('sign_up')) {
                routeTo(window.location.hash);
            } else {
                location.hash = `#/sign_in`;
            }
            getRef('sign_in_button').onclick = () => {
                resolve(getRef('private_key_field').value.trim());
                getRef('private_key_field').value = '';
                routeTo('loading');
            };
            getRef('sign_up_button').onclick = () => {
                resolve(getRef('keys_generator').keys.privKey);
                getRef('keys_generator').clearKeys();
                routeTo('loading');
            };
        }
    });
}
function setSecurePassword() {
    if (!floGlobals.isPrivKeySecured) {
        const password = getRef('secure_pwd_input').value.trim();
        floDapps.securePrivKey(password).then(() => {
            floGlobals.isPrivKeySecured = true;
            notify('Password set successfully', 'success');
            closePopup();
        }).catch(err => {
            notify(err, 'error');
        })
    }
}
function signOut() {
    getConfirmation('Sign out?', { message: 'You are about to sign out of the app, continue?', confirmText: 'Leave', cancelText: 'Stay' })
        .then(async (res) => {
            if (res) {
                await floDapps.clearCredentials();
                location.reload();
            }
        });
}

// detect browser version
function detectBrowser() {
    let ua = navigator.userAgent,
        tem,
        M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
    if (/trident/i.test(M[1])) {
        tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
        return 'IE ' + (tem[1] || '');
    }
    if (M[1] === 'Chrome') {
        tem = ua.match(/\b(OPR|Edge)\/(\d+)/);
        if (tem != null) return tem.slice(1).join(' ').replace('OPR', 'Opera');
    }
    M = M[2] ? [M[1], M[2]] : [navigator.appName, navigator.appVersion, '-?'];
    if ((tem = ua.match(/version\/(\d+)/i)) != null) M.splice(1, 1, tem[1]);
    return M.join(' ');
}
function createRipple(event, target) {
    const circle = document.createElement("span");
    const diameter = Math.max(target.clientWidth, target.clientHeight);
    const radius = diameter / 2;
    const targetDimensions = target.getBoundingClientRect();
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - (targetDimensions.left + radius)}px`;
    circle.style.top = `${event.clientY - (targetDimensions.top + radius)}px`;
    circle.classList.add("ripple");
    const rippleAnimation = circle.animate(
        [
            {
                opacity: 1,
                transform: `scale(0)`
            },
            {
                transform: "scale(4)",
                opacity: 0,
            },
        ],
        {
            duration: 600,
            fill: "forwards",
            easing: "ease-out",
        }
    );
    target.append(circle);
    rippleAnimation.onfinish = () => {
        circle.remove();
    };
}


function getApprovedAggregators() {
    floGlobals.approvedKycAggregators = {};
    return new Promise((resolve, reject) => {
        floBlockchainAPI.readAllTxs(floGlobals.masterAddress).then(({ items: transactions }) => {
            console.log(transactions);
            transactions.filter(tx => floCrypto.isSameAddr(tx.vin[0].addr, floGlobals.masterAddress) && tx.floData.startsWith('KYC'))
                .reverse()
                .forEach(tx => {
                    const { floData, time } = tx;
                    const [service, operationType, operationData, validity] = floData.split('|');
                    switch (operationType) {
                        case 'APPROVE_AGGREGATOR':
                            operationData.split('+').forEach(aggregator => {
                                const [address, label = ''] = aggregator.split(':');
                                floGlobals.approvedKycAggregators[floCrypto.toFloID(address)] = label;
                            });
                            break;
                        case 'REVOKE_AGGREGATOR':
                            operationData.split('+').forEach(aggregator => {
                                const [address, label = ''] = aggregator.split(':');
                                delete floGlobals.approvedKycAggregators[floCrypto.toFloID(address)]
                            });
                            break;
                        default:
                            break;
                    }
                });
            resolve();
        }).catch(e => {
            console.error(e);
            reject(e);
        })
    })
}

function getApprovedKycs() {
    floGlobals.approvedKyc = {};
    return new Promise((resolve, reject) => {
        const aggregatorTxs = Object.keys(floGlobals.approvedKycAggregators).map(aggregator => {
            return floBlockchainAPI.readAllTxs(aggregator);
        });
        if (!aggregatorTxs.length)
            resolve();
        Promise.all(aggregatorTxs).then(aggregatorData => {
            aggregatorData = aggregatorData.flat(1)
                .filter(tx => tx.vin[0].addr in floGlobals.approvedKycAggregators && tx.floData.startsWith('KYC'))
                .sort((a, b) => a.time - b.time);
            for (const tx of aggregatorData) {
                const { floData, time, vin, vout } = tx;
                const [service, operationType, operationData, validity] = floData.split('|');
                switch (operationType) {
                    case 'APPROVE_KYC':
                        operationData.split('+').forEach(address => {
                            floGlobals.approvedKyc[address] = {
                                validFrom: time * 1000,
                                validTo: validity || Date.now() + 10000000,
                                issuedBy: vin[0].addr
                            };
                        });
                        break;
                    case 'REVOKE_KYC':
                        operationData.split('+').forEach(address => {
                            if (!floGlobals.approvedKyc[address]) return
                            floGlobals.approvedKyc[address].validTo = time * 1000;
                            floGlobals.approvedKyc[address].revokedBy = vin[0].addr;
                        });
                        break;
                    default:
                        return;
                }
            }
            resolve();
        }).catch(e => {
            reject(e);
        })
    })
}