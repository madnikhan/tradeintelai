//+------------------------------------------------------------------+
//| MT5 Bridge Expert Advisor                                       |
//| For IC Markets Demo Account via Wine                           |
//+------------------------------------------------------------------+

#property copyright "AI Trading System"
#property link      ""
#property version   "1.00"
#property description "ZeroMQ Bridge for AI Trading System"
#property strict

#include <Zmq/Zmq.mqh>

// Input parameters
input string ZMQ_SERVER_ADDRESS = "tcp://localhost:5555";  // Python server address
input int    ZMQ_SERVER_PORT = 5555;
input double MAX_RISK_PERCENT = 1.5;                       // Max risk per trade
input int    MAGIC_NUMBER = 12345;                         // EA magic number

// Global variables
Context     zmq_context("MT5_AI_Bridge");
Socket      zmq_socket(zmq_context, ZMQ_REP);
bool        connected = false;
string      current_symbol = "";

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("=== AI Trading System MT5 Bridge ===");
   Print("Connecting to ZeroMQ server: ", ZMQ_SERVER_ADDRESS, ":", ZMQ_SERVER_PORT);
   
   // Connect to ZeroMQ server
   if(!zmq_socket.connect(ZMQ_SERVER_ADDRESS + ":" + IntegerToString(ZMQ_SERVER_PORT)))
   {
      Print("Failed to connect to ZeroMQ server");
      return(INIT_FAILED);
   }
   
   connected = true;
   Print("✅ Successfully connected to ZeroMQ server");
   Print("Account: ", AccountInfoInteger(ACCOUNT_LOGIN));
   Print("Balance: $", AccountInfoDouble(ACCOUNT_BALANCE));
   Print("Server: ", AccountInfoString(ACCOUNT_SERVER));
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   if(connected)
   {
      zmq_socket.disconnect(ZMQ_SERVER_ADDRESS + ":" + IntegerToString(ZMQ_SERVER_PORT));
      Print("Disconnected from ZeroMQ server");
   }
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   if(!connected) return;
   
   // Check for incoming messages
   ZmqMsg request;
   if(zmq_socket.recv(request, ZMQ_DONTWAIT))
   {
      string message = request.getData();
      Print("Received: ", message);
      
      // Process the message
      string response = ProcessMessage(message);
      
      // Send response
      ZmqMsg reply(response);
      zmq_socket.send(reply);
   }
}

//+------------------------------------------------------------------+
//| Process incoming JSON messages                                  |
//+------------------------------------------------------------------+
string ProcessMessage(string jsonMessage)
{
   string response = "{}";
   
   // Parse JSON (simplified - in real implementation use proper JSON parser)
   if(StringFind(jsonMessage, "get_account_info") >= 0)
   {
      response = GetAccountInfoJSON();
   }
   else if(StringFind(jsonMessage, "get_symbol_price") >= 0)
   {
      string symbol = ExtractValue(jsonMessage, "symbol");
      response = GetSymbolPriceJSON(symbol);
   }
   else if(StringFind(jsonMessage, "execute_trade") >= 0)
   {
      response = ExecuteTradeJSON(jsonMessage);
   }
   else if(StringFind(jsonMessage, "get_positions") >= 0)
   {
      response = GetPositionsJSON();
   }
   else
   {
      response = "{\"error\": \"Unknown command\"}";
   }
   
   return response;
}

//+------------------------------------------------------------------+
//| Get account information as JSON                                 |
//+------------------------------------------------------------------+
string GetAccountInfoJSON()
{
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double margin = AccountInfoDouble(ACCOUNT_MARGIN);
   double free_margin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   
   string json = "{";
   json += "\"success\": true,";
   json += "\"balance\": " + DoubleToString(balance, 2) + ",";
   json += "\"equity\": " + DoubleToString(equity, 2) + ",";
   json += "\"margin\": " + DoubleToString(margin, 2) + ",";
   json += "\"free_margin\": " + DoubleToString(free_margin, 2) + ",";
   json += "\"currency\": \"" + AccountInfoString(ACCOUNT_CURRENCY) + "\",";
   json += "\"leverage\": " + IntegerToString(AccountInfoInteger(ACCOUNT_LEVERAGE)) + ",";
   json += "\"server\": \"" + AccountInfoString(ACCOUNT_SERVER) + "\",";
   json += "\"login\": " + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   json += "}";
   
   return json;
}

//+------------------------------------------------------------------+
//| Get symbol price as JSON                                        |
//+------------------------------------------------------------------+
string GetSymbolPriceJSON(string symbol)
{
   if(symbol == "") symbol = Symbol();
   
   double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);
   double spread = SymbolInfoInteger(symbol, SYMBOL_SPREAD) * SymbolInfoDouble(symbol, SYMBOL_POINT);
   
   string json = "{";
   json += "\"success\": true,";
   json += "\"symbol\": \"" + symbol + "\",";
   json += "\"bid\": " + DoubleToString(bid, (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS)) + ",";
   json += "\"ask\": " + DoubleToString(ask, (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS)) + ",";
   json += "\"spread\": " + DoubleToString(spread, (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS));
   json += "}";
   
   return json;
}

//+------------------------------------------------------------------+
//| Execute trade from JSON                                         |
//+------------------------------------------------------------------+
string ExecuteTradeJSON(string jsonMessage)
{
   string symbol = ExtractValue(jsonMessage, "symbol");
   string action = ExtractValue(jsonMessage, "action"); // "BUY" or "SELL"
   string volume_str = ExtractValue(jsonMessage, "volume");
   string sl_str = ExtractValue(jsonMessage, "sl");
   string tp_str = ExtractValue(jsonMessage, "tp");
   
   if(symbol == "" || action == "" || volume_str == "")
   {
      return "{\"success\": false, \"error\": \"Missing required parameters\"}";
   }
   
   double volume = StringToDouble(volume_str);
   double sl = (sl_str != "") ? StringToDouble(sl_str) : 0;
   double tp = (tp_str != "") ? StringToDouble(tp_str) : 0;
   
   // Execute the trade
   MqlTradeRequest request = {};
   MqlTradeResult result = {};
   
   ZeroMemory(request);
   ZeroMemory(result);
   
   request.action = TRADE_ACTION_DEAL;
   request.symbol = symbol;
   request.volume = volume;
   request.sl = sl;
   request.tp = tp;
   request.deviation = 10;
   request.magic = MAGIC_NUMBER;
   request.comment = "AI Trading System";
   
   if(action == "BUY")
   {
      request.type = ORDER_TYPE_BUY;
      request.price = SymbolInfoDouble(symbol, SYMBOL_ASK);
      request.type_filling = ORDER_FILLING_FOK;
   }
   else if(action == "SELL")
   {
      request.type = ORDER_TYPE_SELL;
      request.price = SymbolInfoDouble(symbol, SYMBOL_BID);
      request.type_filling = ORDER_FILLING_FOK;
   }
   else
   {
      return "{\"success\": false, \"error\": \"Invalid action: " + action + "\"}";
   }
   
   // Send trade request
   bool success = OrderSend(request, result);
   
   if(success && result.retcode == TRADE_RETCODE_DONE)
   {
      string response = "{";
      response += "\"success\": true,";
      response += "\"order_id\": " + IntegerToString(result.order) + ",";
      response += "\"deal_id\": " + IntegerToString(result.deal) + ",";
      response += "\"volume\": " + DoubleToString(result.volume, 2) + ",";
      response += "\"price\": " + DoubleToString(result.price, (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS)) + ",";
      response += "\"message\": \"Trade executed successfully\"";
      response += "}";
      return response;
   }
   else
   {
      return "{\"success\": false, \"error\": \"Trade failed: " + IntegerToString(result.retcode) + "\"}";
   }
}

//+------------------------------------------------------------------+
//| Get open positions as JSON                                      |
//+------------------------------------------------------------------+
string GetPositionsJSON()
{
   int total = PositionsTotal();
   string json = "{\"success\": true, \"positions\": [";
   
   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0)
      {
         if(i > 0) json += ",";
         json += "{";
         json += "\"ticket\": " + IntegerToString((int)ticket) + ",";
         json += "\"symbol\": \"" + PositionGetString(POSITION_SYMBOL) + "\",";
         json += "\"type\": \"" + (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? "BUY" : "SELL") + "\",";
         json += "\"volume\": " + DoubleToString(PositionGetDouble(POSITION_VOLUME), 2) + ",";
         json += "\"open_price\": " + DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN), 5) + ",";
         json += "\"sl\": " + DoubleToString(PositionGetDouble(POSITION_SL), 5) + ",";
         json += "\"tp\": " + DoubleToString(PositionGetDouble(POSITION_TP), 5) + ",";
         json += "\"profit\": " + DoubleToString(PositionGetDouble(POSITION_PROFIT), 2);
         json += "}";
      }
   }
   
   json += "]}";
   return json;
}

//+------------------------------------------------------------------+
//| Extract value from simple JSON string                           |
//+------------------------------------------------------------------+
string ExtractValue(string json, string key)
{
   string search = "\"" + key + "\":";
   int start = StringFind(json, search);
   if(start == -1) return "";
   
   start += StringLen(search);
   int end = StringFind(json, ",", start);
   if(end == -1) end = StringFind(json, "}", start);
   if(end == -1) return "";
   
   string value = StringSubstr(json, start, end - start);
   value = StringTrimLeft(value);
   value = StringTrimRight(value);
   
   // Remove quotes if present
   if(StringGetCharacter(value, 0) == '"')
      value = StringSubstr(value, 1, StringLen(value) - 2);
   
   return value;
}

