import time
import pyotp
import pandas as pd
from aceapi.aceapi import AceApi
import logging
logging.getLogger("aceapi").setLevel(logging.INFO)

"""Initialize API"""

api_key = '***************'
user_id = '*******'
password = '**********'
api_secret = '***************'
totp_secret = '*************'
algo_id ='******'


api = AceApi(api_key, user_id, password, api_secret,algo_id)

"""Generate TOTP and validate 2FA"""
totp = pyotp.TOTP(totp_secret)
print("Generated TOTP:", totp.now())
api.validate_2fa_with_totp(totp.now())
api.generate_session()
print("Access token:", api.access_token)
header = api.get_headers()
print("headers:",header)

"""Place Normal Order"""
order_params = {
        "action": "BUY",
        "exchange": "NSE",
        "token": "11915",
        "order_type": "LIMIT",
        "product_type": "DELIVERY",
        "quantity": "1",
        "disclose_quantity": "0",
        "price": "19.33",
        "trigger_price": "0",
        "stop_loss_price": "0",
        "trailing_stop_loss": "0",
        "validity": "DAY",
        "tag": "",
        "client_ip": "10.171.19.147",
        "x-algo-id": "",

    }
order = api.placeOrder(order_params)
if order:
    print("Order placed successfully. Order ID: ", order)
else:
    print("Failed to place order")

#
"""Modify order parameters"""
order_id = 'NXDAG0000134'
order_params = {
    'exchange': 'NSE',
    'token': '11536',
    'order_type': 'LIMIT',
    'quantity': '8',
    'disclose_quantity': '0',
    'price': '3150',
    'stop_loss_price': '0',
    'trigger_price': '0',
    'validity': ''
}

modify_order = api.modifyOrder(order_id, order_params)
print("Modify Order Response:", modify_order)

"""Cancel Order"""
cancelOrder = api.cancel_order(order_id="1192241230763")
print("Cancel Order : ", cancelOrder)

"""For AMO Order"""
orderParams ={
    "action": "BUY",
    "exchange": "NSE",
    "token": "11536",
    "order_type": "STOPLOSS_LIMIT",
    "product_type": "DELIVERY",
    "quantity": "5",
    "disclose_quantity": "0",
    "price": "3650",
    "trigger_price": "3600",
    "stop_loss_price": "0",
    "trailing_stop_loss": "0",
    "validity": "DAY",
    "tag": ""
}
amoOrder= api.placeAmoOrder(orderParams)
if amoOrder:
    print("Amo order placed succesfully :",amoOrder)
else:
    print("Failed to placed order")

AmoOrder=api.placeAmoOrder(orderParams)
print("Amo Order : ", AmoOrder)

""" For AMO Modify Order"""
order_id = 'ONJRJ00001A3'
orderParams = {
    "exchange": "NSE",
    "token": "11536",
    "order_type": "LIMIT",
    "quantity": "10",
    "disclose_quantity": "0",
    "price": "3420",
    "stop_loss_price": "0",
    "trigger_price": "0",
    "validity":""
}
amoModifyOrder = api.modifyAmoOrder(order_id, orderParams)
print("Modify Amo Order : ", amoModifyOrder)

"""Cancel AMO Order """
cancelAmoResponse = api.cancelAmoOrder(order_id='ONJRJ00001A3')
print("Cancel Amo Order : ", cancelAmoResponse)

""" Place BO order """
orderparams = {
    "action": "BUY",
    "exchange": "NFO",
    "token": "48757",
    "order_type": "LIMIT",
    "product_type": "BO",
    "quantity": "50",
    "disclose_quantity": "0",
    "price": "17600",
    "stop_loss_price": "17200",
    "trigger_price": "17490",
    "target_price": "18000",
    "trailing_stop_loss": "0",
    "validity": "DAY",
    "validity_date": "",
    "tag": ""
}
boReasponse = api.placeBoOrder(orderparams)
print("BO order Response : ", boReasponse)

""" BO Modify order """
order_id = 'ONJRJ00001A3'
orderparams = {
    "exchange": "NFO",
    "token": "48757",
    "order_type": "LIMIT",
    "quantity": "100",
    "disclose_quantity": "0",
    "price": "17610",
    "stop_loss_price": "17210",
    "trigger_price": "17500",
    "target_price": "18010",
    "validity":"",
    "parent_order_id":"3"
}
boModifyResponse = api.modifyBoOrder(order_id, orderparams)
print("Bo modify order Response : ", boModifyResponse)

""" Cancel Bo order """
order_id ='ONJRJ00001A3'
BOcancelResponse = api.cancelBoOrder(order_id)
print("BO cancel order Response : ", BOcancelResponse)
# #
"""Get fund details"""
fund = api.get_fund_details()
print("Fund Details: ", fund.json())

"""Get LTP quotes"""
order_params = {
    "exchange": "NSE",
    "tokens": ["11536"]
}
ltp_quotes_response = api.ltpQuotes(order_params)

if ltp_quotes_response.status_code == 200:
    print("LTP Quotes: ", ltp_quotes_response.json())
else:
    print("Failed to retrieve LTP quotes: ", ltp_quotes_response.content)

"""Get order book"""
order_book_response = api.orderBook()
if order_book_response is not None:
    print("Order Book: ", order_book_response)
else:
    print("Failed to retrieve order book")

"""Get Trade book"""
trade_book_response = api.tradeBook()
if trade_book_response is not None:
    print("Trade Book: ", trade_book_response)
else:
    print("Failed to retrieve trade book")


"""Get Holdings"""
holdingResponse = api.getHoldings()
if holdingResponse is not None:
    print("Holdings:", holdingResponse.json())
else:
    print("Failed to retrieve Holdings")

"""Get Positions"""
positionResponse = api.positions()
if positionResponse is not None:
    print("Position : ", positionResponse.json())
else:
    print("Failed to retrieve Positions")


"""Get Position Conversion"""
order_params = {
    "exchange": "NSE",
    "token": "11536",
    "quantity": "1",
    "action": "BUY",
    "product_type": "DELIVERY",
    "new_product_type": "INTRADAY"
}
positionConversionResponse = api.positionConversion(order_params)
print("Position Conversion Response:", positionConversionResponse.json())
#
"""Scrip Master"""
masterResponse = api.scripMaster()
print("Scrip Master :", masterResponse.json())

"""Fetch Scrip Master CSV"""
csv_content = api.scripMasterCSV()
if csv_content:
    from io import StringIO
    df = pd.read_csv(StringIO(csv_content.decode('utf-8')))
    print("Scrip Master CSV DataFrame:")
    print(df.head())
else:
    print("Failed to fetch Scrip Master CSV.")


"""Scrip Master Exchange"""
exchange="NSE"
ScripMasterExchange = api.getScripMasterExchangeJson(exchange)
print("Scrip Master Exchange : ", ScripMasterExchange.json())


"""Script Master Exchange CSV"""
exchange = 'MCX'
scrip_master_csv = api.getScripMasterExchangeCsv(exchange).content
if scrip_master_csv:
    from io import StringIO
    df= pd.read_csv(StringIO(scrip_master_csv.decode('utf-8')))
    print("Scrip Master Exchange CSV fetched successfully:")
else:
    print("Failed to fetch Scrip Master Exchange CSV.")

"""Market Quotes"""
orderparams = {
    "exchange": "NSE",
    "tokens": ["11536"]
}
quotesResponse = api.marketQuotes(orderparams)
if quotesResponse.status_code == 200:
    print("Market Quotes:", quotesResponse.json())
else:
    print("Failed to retrieve LTP quotes:", quotesResponse.content)


"""OHLC Quotes"""
orderparams = {
  "exchange": "NSE",
  "tokens": ["11536"]
}
ohlcResponse = api.ohlcQuotes(orderparams)
print("OHLC Quotes : ", ohlcResponse)


