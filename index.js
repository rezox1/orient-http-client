const axios = require('axios');
const btoa = require('btoa');

const CONNECTION_ERROR_CODES = ["ECONNABORTED", "ECONNRESET", "ETIMEDOUT"];

function OrientDBApp({orientUrl, orientDBName, orientUsername, orientPassword}){
    const orientInstance = axios.create({
        "baseURL": orientUrl,
        "timeout": 60000
    });

    const CookieManager = new globalCookieManager({
        "loginFunction": async function loginFunction(){
            const loginData = await orientInstance.get("connect/" + orientDBName, {
                headers: {
                    "Content-Type": "application/json;charset=UTF-8",
                    "Authorization": "Basic " + btoa(orientUsername + ":" + orientPassword)
                }
            });

            let RawUserCookie = loginData.headers["set-cookie"][0],
                UserCookie = RawUserCookie.substring(0, RawUserCookie.indexOf(";"));

            return UserCookie;
        }, 
        "checkCookieFunction": async function checkCookieFunction(){
            let checkCookieResult = true;
            
            try {
                const cookie = CookieManager.getCookie();
                const searchString = "SELECT count(*) FROM OUser";
                await orientInstance.post(`command/${orientDBName}/sql/-/20?format=rid,type,version,class,graph`, searchString, {
                    headers: {
                        "Content-Type": "application/json;charset=UTF-8",
                        "Cookie": cookie
                    }
                });
            } catch (err) {
                if (CONNECTION_ERROR_CODES.includes(err.code)) {
                    console.warn("There are connection troubles...");

                    return await checkCookieFunction.apply(this, arguments);
                } else {
                    console.error("Error while evaluating checkCookieFunction from orient's inctance: " + err);

                    checkCookieResult = false;
                }
            }
            return checkCookieResult;
        }
    });

    this.makeQuery = async function(queryString){
        if (!queryString) {
            throw new Error("queryString is not defined");
        }

        const userCookie = await CookieManager.getActualCookie();
        const {
            "data":{"result":searchResult}
        } = await orientInstance.post(`command/${orientDBName}/sql/-/20?format=rid,type,version,class,graph`, queryString, {
            headers: {
                "Content-Type": "application/json;charset=UTF-8",
                "Cookie": userCookie
            }
        });

        return searchResult;
    }
}

function globalCookieManager({loginFunction, checkCookieFunction}){
    async function refreshCookie() {
        cookie = await loginFunction();
        return cookie;
    }

    let cookie = null;

    this.getCookie = function() {
        return cookie;
    }
    this.getActualCookie = async function() {
        if (!cookie) {
            return await refreshCookie();
        } else {
            let checkCookieResult = await checkCookieFunction(cookie);
            if (checkCookieResult === true) {
                return cookie;
            } else {
                return await refreshCookie();
            }
        }
    }
    this.refreshCookie = refreshCookie;
}

module.exports.OrientDBApp = OrientDBApp;