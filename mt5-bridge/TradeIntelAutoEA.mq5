//+------------------------------------------------------------------+
//| TradeIntel Auto EA — TCP socket execution (Mac/Wine fallback)    |
//| Listens on 127.0.0.1:19532 for JSON commands from Auto Pilot      |
//+------------------------------------------------------------------+
#property copyright "TradeIntel AI"
#property version   "1.00"
#property strict

input int    SOCKET_PORT = 19532;
input int    MAGIC_NUMBER = 54321;

int server_socket = INVALID_HANDLE;

//+------------------------------------------------------------------+
int OnInit()
{
   Print("TradeIntel Auto EA socket server starting on port ", SOCKET_PORT);
   server_socket = SocketCreate();
   if(server_socket == INVALID_HANDLE)
   {
      Print("SocketCreate failed: ", GetLastError());
      return INIT_FAILED;
   }
   if(!SocketBind(server_socket, SOCKET_PORT))
   {
      Print("SocketBind failed: ", GetLastError());
      SocketClose(server_socket);
      return INIT_FAILED;
   }
   if(!SocketListen(server_socket, 5))
   {
      Print("SocketListen failed: ", GetLastError());
      SocketClose(server_socket);
      return INIT_FAILED;
   }
   EventSetTimer(1);
   Print("TradeIntel Auto EA listening on 127.0.0.1:", SOCKET_PORT);
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   if(server_socket != INVALID_HANDLE)
      SocketClose(server_socket);
}

//+------------------------------------------------------------------+
void OnTimer()
{
   if(server_socket == INVALID_HANDLE) return;

   int client = SocketAccept(server_socket, 100);
   if(client == INVALID_HANDLE) return;

   uchar buf[];
   int received = SocketRead(client, buf, 4096, 500);
   if(received <= 0)
   {
      SocketClose(client);
      return;
   }

   string msg = CharArrayToString(buf, 0, received);
   string response = ProcessCommand(msg);
   SocketSend(client, response);
   SocketClose(client);
}

//+------------------------------------------------------------------+
string ProcessCommand(string json)
{
   string action = JsonGet(json, "action");
   if(action == "OPEN")
   {
      string symbol = JsonGet(json, "symbol");
      string type = JsonGet(json, "type");
      double volume = StringToDouble(JsonGet(json, "volume"));
      double sl = StringToDouble(JsonGet(json, "stop_loss"));
      double tp = StringToDouble(JsonGet(json, "take_profit"));

      bool is_buy = (type == "BUY");
      MqlTick tick;
      if(!SymbolInfoTick(symbol, tick))
         return "{\"success\":false,\"error\":\"no tick\"}";

      MqlTradeRequest req = {};
      MqlTradeResult res = {};
      req.action = TRADE_ACTION_DEAL;
      req.symbol = symbol;
      req.volume = volume;
      req.type = is_buy ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
      req.price = is_buy ? tick.ask : tick.bid;
      req.sl = sl;
      req.tp = tp;
      req.deviation = 20;
      req.magic = MAGIC_NUMBER;
      req.comment = "TradeIntel AutoPilot";
      req.type_filling = ORDER_FILLING_IOC;

      if(!OrderSend(req, res))
         return "{\"success\":false,\"error\":\"ordersend\"}";

      return StringFormat("{\"success\":true,\"order_id\":%I64u,\"price\":%.5f}",
                          res.order, res.price);
   }
   return "{\"success\":false,\"error\":\"unknown action\"}";
}

//+------------------------------------------------------------------+
string JsonGet(string json, string key)
{
   string search = "\"" + key + "\":";
   int pos = StringFind(json, search);
   if(pos < 0) return "";
   pos += StringLen(search);
   while(pos < StringLen(json) && (StringGetCharacter(json, pos) == ' ' || StringGetCharacter(json, pos) == '"'))
      pos++;
   int end = pos;
   while(end < StringLen(json))
   {
      ushort c = StringGetCharacter(json, end);
      if(c == '"' || c == ',' || c == '}') break;
      end++;
   }
   string val = StringSubstr(json, pos, end - pos);
   StringReplace(val, "\"", "");
   return val;
}
