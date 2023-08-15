function checkIfSentByMasterAddress(tx) {
    return tx.vin.some(vin => vin.addresses[0] === floGlobals.adminID);
}

function getApprovedAggregators() {
    floGlobals.approvedKycAggregators = {};
    return new Promise((resolve, reject) => {
        floBlockchainAPI.readAllTxs(floGlobals.adminID).then(({ items: transactions }) => {
            console.log(transactions);
            transactions.filter(tx => checkIfSentByMasterAddress(tx) && tx.floData.startsWith('KYC'))
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
                .filter(tx => tx.vin[0].addresses[0] in floGlobals.approvedKycAggregators && tx.floData.startsWith('KYC'))
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
                                issuedBy: vin[0].addresses[0]
                            };
                        });
                        break;
                    case 'REVOKE_KYC':
                        operationData.split('+').forEach(address => {
                            if (!floGlobals.approvedKyc[address]) return
                            floGlobals.approvedKyc[address].validTo = time * 1000;
                            floGlobals.approvedKyc[address].revokedBy = vin[0].addresses[0];
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