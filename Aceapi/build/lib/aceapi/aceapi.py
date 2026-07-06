"""
Created on Thur Apr-16

@author: rima giri
"""


import json
import logging
import re
import uuid
import socket
import requests
import hashlib
import hmac
from requests import get
from logzero import logger

log = logging.getLogger(__name__)


class AceApi:
    _root_url = "https://openapi.smctradeonline.com"

    url = {
        "api.login": "/auth/login",
        "api.logout": "/auth/logout",
        "api.profile": "/auth/profile",
        "api.2fa": "/auth/twofa/verify",
        "api.generate.session": "/auth/token",

        "api.place.order": "/orders/normal",
        "api.modify.order": "/orders/normal/{order_id}",
        "api.cancel.order": "/orders/normal/{order_id}",

        """ For AMO order """
        "api.place.amo.order": "/orders/amo",
        "api.modify.amo.order": "/orders/amo/{order_id}",
        "api.cancel.amo.order": "/orders/amo/{order_id}",

        """ For BO order """
        "api.place.bo.order": "/orders/bo",
        "api.modify.bo.order": "/orders/bo/{order_id}",
        "api.cancel.bo.order": "/orders/bo/{order_id}",

        "api.order.book": "/reports/order-book",
        "api.trade.book": "/reports/trade-book",

        "api.holding": "/portfolio/holdings",
        "api.position": "/portfolio/positions",
        "api.position.conversion": "/portfolio/position-conversion",

        "api.fund.details": "/funds",

        "api.scrip.master.json": "/scrip-master",
        "api.scrip.master.csv": "/scrip-master/csv",
        "api.scrip.master.exchange.json": "/scrip-master/{exchange}",
        "api.scrip.master.exchange.csv": "/scrip-master/csv/{exchange}",
        "api.market.quotes": "/quotes",
        "api.ohlc.quotes": "/quotes/ohlc",
        "api.ltp.quotes": "/quotes/ltp"
    }

    err_message = {
        "api.login": "Please check your apiKey, userId, password or apiSecret.",
        "api.login.enable.2fa": "Please enable TOTP with Administrator.",
        "api.2fa": "Invalid TOTP",
        "api.generate.session": "Invalid input, Please try again."
    }

    # try:
    #     clientPublicIp = " " + get('https://api.ipify.org').text
    #     if " " in clientPublicIp:
    #         clientPublicIp = clientPublicIp.replace(" ", "")
    #     hostname = socket.gethostname()
    #     clientLocalIp = socket.gethostbyname(hostname)
    # except Exception as e:
    #     logger.error(f"Exception while retrieving IP Address, using local host IP address: {e}")
    # finally:
    #     clientPublicIp = "106.193.147.98"
    #     clientLocalIp = "10.171.19.147"
    #
    # clientMacAddress = ':'.join(re.findall('..', '%012x' % uuid.getnode()))
    # accept = "application/json"
    # userType = "USER"
    # sourceID = "WEB"


    def __init__(self, api_key=None, user_id=None, password=None, api_secret=None):
        self.algo_id = None
        self.api_key = api_key
        self.api_secret = api_secret
        self.user_id = user_id
        self.password = password
        self.request_token = None
        self.access_token = None
        self.signature = None
        self._get_request_token()

        try:
            self.clientPublicIp = get('https://api.ipify.org').text.strip()
        except Exception as e:
            logger.error(f"Public IP fetch failed: {e}")
            self.clientPublicIp = "127.0.0.1"

        try:
            hostname = socket.gethostname()
            self.clientLocalIp = socket.gethostbyname(hostname)
        except Exception as e:
            logger.error(f"Local IP fetch failed: {e}")
            self.clientLocalIp = "127.0.0.1"

        self.clientMacAddress = ':'.join(re.findall('..', '%012x' % uuid.getnode()))

        self.accept = "application/json"
        self.userType = "USER"
        self.sourceID = "WEB"


    def _generate_url(self, url_key, query_param=False, order_id=None, exchange=None):
        if url_key in self.url:
            if exchange:
                url = self.url[url_key].format(exchange=exchange)
            else:
                url = self.url[url_key].format(order_id=order_id) if order_id else self.url[url_key]
        else:
            url = url_key

        logger.debug(f"Generated URL: {url}")
        if query_param:
            return "{}{}?api-key={}".format(self._root_url, url, self.api_key)
        else:
            return "{}{}".format(self._root_url, url)

    def _request(self, url_key, data=None, headers=None, query_param=False, method="POST", exchange=None):
        if url_key.startswith("http"):
            url = url_key
        else:
            url = self._generate_url(url_key, query_param, exchange=exchange)

        logger.debug(f"Request URL: {url}")
        logger.debug(f"Request Headers: {headers}")

        try:
            if method == "GET":
                response = requests.get(url, headers=headers, params=data)
            elif method == "DELETE":
                response = requests.delete(url, headers=headers)
            else:
                response = requests.post(url, data=data, headers=headers)
            return response
        except Exception as e:
            raise e

    def _check_response(self, url_key, response):
        if response.status_code != 200:
            print("Response: {code} {content}".format(code=response.status_code, content=response.content.upper()))
            raise Exception(self.err_message.get(url_key, "An error occurred"))

        data = response.json()
        if url_key == "api.login" and data["data"]["is_2fa_enabled"]:
            print(self.err_message["api.login.enable.2fa"])
        return data

    def _get_request_token(self):
        params = {
            "platform": "api",
            "data": {
                "client_id": self.user_id,
                "password": self.password
            }
        }

        resp = self._request("api.login", json.dumps(params), self.get_common_header(), True)
        data = self._check_response("api.login", resp)

        self.request_token = data["data"]["token"]

    def validate_2fa_with_totp(self, totp):
        params = {
            "platform": "api",
            "data": {
                "client_id": self.user_id,
                "token": self.request_token,
                "action": "api-key-validation",
                "otp": totp
            }
        }

        resp = self._request("api.2fa", json.dumps(params), self.get_common_header(), True)
        data = self._check_response("api.2fa", resp)
        self.request_token = data["data"]["request_token"]
        self.generate_session()

    def get_signature(self):
        key1 = bytes(self.api_key + self.request_token, 'UTF-8')
        key2 = bytes(self.api_secret, 'UTF-8')
        self.signature = hmac.new(key1, key2, hashlib.sha256).hexdigest()

    def generate_session(self):
        self.get_signature()

        params = {
            "api_key": self.api_key,
            "signature": self.signature,
            "req_token": self.request_token
        }

        resp = self._request("api.generate.session", json.dumps(params), self.get_common_header())
        data = self._check_response("api.generate.session", resp)
        self.access_token = data["data"]["access_token"]
        print(f"Session generated successfully. Access token: {self.access_token}")

    def get_common_header(self):
        return {"Content-Type": "application/json"}

    def get_headers(self):
        return {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "request_token": self.request_token,
            "x-Platform": "api",
            "X-Access-Token": self.access_token,
            "x-Api-key": self.api_key,
            "X-Client-Id": self.user_id,
            "x-algo-id": self.algo_id
        }

    def _deleteRequest(self, route, params=None):
        """Alias for sending a DELETE request."""
        return self._request(route, data=params, headers=self.get_headers(), method="DELETE")

    def _putRequest(self, url_key, data=None, headers=None, query_param=False, order_id=None):
        url = self._generate_url(url_key, query_param, order_id)
        try:
            response = requests.put(url, data=data, headers=headers)
            return response
        except Exception as e:
            raise e

    def _postRequest(self, route, params=None):
        """Alias for sending a POST request."""
        url_key = route  # Assigning the route directly to url_key
        return self._request(url_key, data=params, headers=self.get_headers(), method="POST")

    def _postRequests(self, route, params=None, exchange=None):
        """Alias for sending a POST request."""
        url_key = route
        return self._request(url_key, data=params, headers=self.get_headers(), method="POST", exchange=exchange)

    def _getRequests(self, route, params=None, exchange=None):
        """Alias for sending a GET request."""
        return self._request(route, data=params, headers=self.get_headers(), method="GET", exchange=exchange)


    def _getRequest(self, route, params=None):
        """Alias for sending a GET request."""
        return self._request(route, data=params, headers=self.get_headers(), method="GET")



    """ Fund Details """
    def get_fund_details(self):
        fundResponse = self._getRequest("api.fund.details")
        return fundResponse

    def placeOrder(self, orderparams):
        params = orderparams
        for k in list(params.keys()):
            if params[k] is None:
                del (params[k])
        logger.info(f"Placing order with params: {params}")
        response = self._postRequest("api.place.order", json.dumps(params))
        try:
            response_data = response.json()
            logger.info(f"Response data: {response_data}")
            return response_data
        except requests.exceptions.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            logger.error(f"Raw response content: {response.text}")
        except Exception as e:
            logger.error(f"An error occurred: {e}")
        return None

    """ Modify Normal Order """

    def modifyOrder(self, order_id, orderparams):
        # Modify order logic
        route = "api.modify.order"
        url = self._generate_url(route, order_id=order_id)
        try:
            response = requests.put(url, data=json.dumps(orderparams), headers=self.get_headers())
            response_data = response.json()
            logger.info(f"Modify Order Response: {response_data}")
            return response_data
        except Exception as e:
            logger.error(f"An error occurred while modifying order: {e}")
            return None

    def cancel_order(self, order_id):
        try:
            url = f"{self._root_url}/orders/normal/{order_id}"
            headers = self.get_headers()
            response = requests.delete(url, headers=headers)
            if response.status_code == 200:
                print("Order canceled successfully")
            else:
                print(f"Failed to cancel order: {response.json()}")
            return response.json()
        except Exception as e:
            print(f"Exception occurred while canceling order: {e}")

    """ For After Market Hour Order """
    """ Place AMO Order """
    def placeAmoOrder(self, orderparams):
        params = orderparams
        for k in list(params.keys()):
            if params[k] is None:
                del params[k]
        logger.info(f"Placing AMO order with params: {params}")
        response = self._postRequest("/orders/amo", json.dumps(params))
        try:
            response_data = response.json()
            return response_data
        except requests.exceptions.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            logger.error(f"Raw response content: {response.text}")
        except Exception as e:
            logger.error(f"An error occurred: {e}")
        return None

    """ Modify AMO Order"""
    def modifyAmoOrder(self, order_id, orderparams):
        # Modify order logic
        route = "api.modify.amo.order"
        url = self._generate_url(route, order_id=order_id)
        try:
            response = requests.put(url, data=json.dumps(orderparams), headers=self.get_headers())
            response_data = response.json()
            logger.info(f"Modify Order AMO Response: {response_data}")
            return response_data
        except Exception as e:
            logger.error(f"An error occurred while modifying order: {e}")
            return None

    """ Cancel AMO Order """
    def cancelAmoOrder(self, order_id):
        route = "api.cancel.amo.order"
        url = self._generate_url(route, order_id=order_id)
        try:
            response = self._deleteRequest(route, params={"order_id": order_id})
            if response.status_code == 200:
                logger.info("Order deleted successfully.")
            else:
                logger.error(f"Failed to delete order: {response.json()}")
        except Exception as e:
            logger.error(f"An error occurred while deleting order: {e}")

    """ Place BO Order """
    def placeBoOrder(self, orderparams):
        params = orderparams
        for k in list(params.keys()):
            if params[k] is None:
                del params[k]
        logger.info(f"Placing AMO order with params: {params}")
        response = self._postRequest("/orders/bo", json.dumps(params))
        try:
            response_data = response.json()
            return response_data
        except requests.exceptions.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            logger.error(f"Raw response content: {response.text}")
        except Exception as e:
            logger.error(f"An error occurred: {e}")
        return None

    """ Modify BO Order"""
    def modifyBoOrder(self, order_id, orderparams):
        route = "api.modify.bo.order"
        url = self._generate_url(route, order_id=order_id)
        try:
            response = requests.put(url, data=json.dumps(orderparams), headers=self.get_headers())
            response_data = response.json()
            logger.info(f"Modify Order AMO Response: {response_data}")
            return response_data
        except Exception as e:
            logger.error(f"An error occurred while modifying order: {e}")
            return None

    """ Cancel BO Order """
    def cancelBoOrder(self, order_id):
        route = "api.cancel.bo.order"
        url = self._generate_url(route, order_id=order_id)
        try:
            response = self._deleteRequest(route, params={"order_id": order_id})
            if response.status_code == 200:
                logger.info("Order deleted successfully.")
            else:
                logger.error(f"Failed to delete order: {response.json()}")
        except Exception as e:
            logger.error(f"An error occurred while deleting order: {e}")

    """ Ltp Quotes """
    def ltpQuotes(self, orderparams):
        params = json.dumps(orderparams)  # Ensure the params are properly formatted as JSON
        headers = self.get_common_header()
        headers.update(self.get_headers())
        ltpquotesResponse = self._postRequest("api.ltp.quotes", params)
        return ltpquotesResponse

    """ Order Book """
    def orderBook(self):
        orderBookResponse = self._getRequest("api.order.book")
        try:
            response_data = orderBookResponse.json()
            return response_data
        except requests.exceptions.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            logger.error(f"Raw response content: {orderBookResponse.text}")
        except Exception as e:
            logger.error(f"An error occurred: {e}")
        return None

    """ Trade Book """
    def tradeBook(self):
        tradeBookResponse = self._getRequest("api.trade.book")
        try:
            response_data = tradeBookResponse.json()
            return response_data
        except requests.exceptions.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            logger.error(f"Raw response content: {tradeBookResponse.text}")
        except Exception as e:
            logger.error(f"An error occurred: {e}")
        return None

    """ Holdings """
    def getHoldings(self):
        holdings = self._getRequest("api.holding")
        return holdings

    """ Position """
    def positions(self):
        positionResponse = self._getRequest("api.position")
        return positionResponse

    """ Position Conversion """
    def positionConversion(self, positionConversionParams):
        response = self._putRequest("api.position.conversion", data=json.dumps(positionConversionParams),
                                    headers=self.get_headers())
        return response

    """ Script Master Json """
    def scripMaster(self):
        scripResponse = self._getRequest("api.scrip.master.json")
        return scripResponse

    """ Script Master CSV """
    def scripMasterCSV(self):
        response = self._getRequest("api.scrip.master.csv")
        if response.status_code == 200:
            return response.content
        else:
            logger.error(f"Failed to fetch Scrip Master CSV. Status code: {response.status_code}")
            return None

    """scrip master exchange """
    def getScripMasterExchangeJson(self, exchange):
        script = self._getRequests("api.scrip.master.exchange.json", exchange=exchange)
        return script

    """ Scrip Master Exchange CSV """
    def getScripMasterExchangeCsv(self, exchange):
        script = self._getRequests("api.scrip.master.exchange.csv", exchange=exchange)
        return script

    """ Market Quotes"""
    def marketQuotes(self, orderparams):
        params = json.dumps(orderparams)  # Ensure the params are properly formatted as JSON
        headers = self.get_common_header()
        headers.update(self.get_headers())
        marketQuotesResponse = self._postRequest("api.market.quotes", params)
        return marketQuotesResponse

    """ OHLC Quotes """
    def ohlcQuotes(self, orderparams):

        params = json.dumps(orderparams)
        headers = self.get_common_header()
        headers.update(self.get_headers())

        response = self._postRequest("api.ohlc.quotes", params)
        if response.status_code == 200:
            try:
                return response.json()
            except ValueError:
                return {"error": "Invalid JSON response", "response_text": response.text}
        else:
            return {"error": "Request failed", "status_code": response.status_code, "details": response.text}

    """ LTP Quotes """
    def ltpQuotes(self, orderparams):
        """
        Fetch OHLC (Open, High, Low, Close) quotes.
        :param orderparams: A dictionary containing the necessary parameters for the request.
        :return: The response content from the OHLC API.
        """
        params = json.dumps(orderparams)
        headers = self.get_common_header()
        headers.update(self.get_headers())

        response = self._postRequest("api.ltp.quotes", params)

        if response.status_code == 200:
            try:
                return response.json()
            except ValueError:
                return {"error": "Invalid JSON response", "response_text": response.text}
        else:
            return {"error": "Request failed", "status_code": response.status_code, "details": response.text}


    """ Trade Book """
    def tradeBook(self):
        tradeBookResponse = self._getRequest("api.trade.book")
        return tradeBookResponse


    # def _user_agent(self):
    #     return (__title__ + "-python/").capitalize() + __version__
