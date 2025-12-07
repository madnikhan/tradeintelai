//+------------------------------------------------------------------+
//| MT5 File Bridge Expert Advisor                                  |
//| For IC Markets Demo Account via Wine (File-Based Communication) |
//+------------------------------------------------------------------+

#property copyright "AI Trading System"
#property link      ""
#property version   "1.00"
#property description "File-Based Bridge for AI Trading System"
#property strict

// Input parameters
input string COMMANDS_DIR = "mt5-commands";      // Commands directory (relative to MT5 data folder)
input string RESPONSES_DIR = "mt5-responses";    // Responses directory
input int    POLL_INTERVAL_MS = 500;             // Poll interval in milliseconds
input int    MAGIC_NUMBER = 12345;               // EA magic number
input double MAX_RISK_PERCENT = 1.5;             // Max risk per trade

// Global variables
string commands_path = "";
string responses_path = "";
datetime last_check = 0;
int processed_files = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("=== AI Trading System MT5 File Bridge ===");
   
   // Get MT5 data folder path
   string data_folder = TerminalInfoString(TERMINAL_DATA_PATH);
   string common_folder = data_folder + "\\MQL5\\Files\\";
   
   // Set up paths
   commands_path = common_folder + COMMANDS_DIR + "\\";
   responses_path = common_folder + RESPONSES_DIR + "\\";
   
   Print("📁 Commands directory: ", commands_path);
   Print("📁 Responses directory: ", responses_path);
   Print("✅ File Bridge EA initialized");
   Print("Account: ", AccountInfoInteger(ACCOUNT_LOGIN));
   Print("Balance: $", AccountInfoDouble(ACCOUNT_BALANCE));
   Print("Server: ", AccountInfoString(ACCOUNT_SERVER));
   
   // Test file access - try to create a test file to verify directory access
   string test_file = COMMANDS_DIR + "/test_access.json";
   int test_handle = FileOpen(test_file, FILE_WRITE|FILE_TXT|FILE_ANSI, 0);
   if(test_handle == INVALID_HANDLE)
   {
      test_handle = FileOpen(test_file, FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON);
   }
   if(test_handle != INVALID_HANDLE)
   {
      FileWriteString(test_handle, "test");
      FileClose(test_handle);
      FileDelete(test_file, 0);
      if(GetLastError() != 0) FileDelete(test_file, FILE_COMMON);
      Print("✅ File access test: SUCCESS - EA can access commands directory");
   }
   else
   {
      Print("❌ File access test: FAILED - EA cannot access commands directory");
      Print("❌ Last error: ", GetLastError());
      Print("❌ Try path: ", test_file);
   }
   
   last_check = TimeCurrent();
   
   // Set up timer to scan for commands every POLL_INTERVAL_MS milliseconds
   // Use at least 1 second for Wine compatibility (EventSetTimer may not work with < 1 second)
   int timer_seconds = (POLL_INTERVAL_MS < 1000) ? 1 : (POLL_INTERVAL_MS / 1000);
   EventSetTimer(timer_seconds);
   
   Print("⏰ Timer set to scan every ", timer_seconds, " second(s) (requested: ", POLL_INTERVAL_MS, "ms)");
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer(); // Stop the timer
   Print("🛑 File Bridge EA stopped. Processed ", processed_files, " commands.");
}

//+------------------------------------------------------------------+
//| Timer function - called every POLL_INTERVAL_MS                   |
//+------------------------------------------------------------------+
void OnTimer()
{
   static int timer_count = 0;
   timer_count++;
   // Log every call for debugging (we can reduce later once confirmed working)
   if(timer_count == 1 || timer_count % 5 == 0) // Log every 5 calls for visibility
   {
      Print("⏰ OnTimer called (count: ", timer_count, ") - scanning for commands...");
   }
   ScanForCommands();
}

//+------------------------------------------------------------------+
//| Expert tick function (kept for compatibility)                    |
//+------------------------------------------------------------------+
void OnTick()
{
   // Also scan on tick as a fallback (in case timer doesn't work in Wine)
   // But only log occasionally to avoid spam
   static int tick_count = 0;
   tick_count++;
   if(tick_count == 1 || tick_count % 100 == 0) // Log every 100 ticks
   {
      Print("📊 OnTick called (count: ", tick_count, ") - scanning for commands...");
   }
   ScanForCommands();
}

//+------------------------------------------------------------------+
//| Scan for command files and process them                          |
//+------------------------------------------------------------------+
void ScanForCommands()
{
   static int scan_count = 0;
   scan_count++;
   
   string first_file;
   long handle = INVALID_HANDLE;
   
   // Command prefixes to check
   string command_prefixes[] = {
      "account_",
      "positions_",
      "closed_positions_",
      "price_",
      "trade_",
      "historical_",
      "test_"
   };
   
   // Method 1: Try WITHOUT FILE_COMMON first (Wine compatibility)
   string search_pattern = COMMANDS_DIR + "/*.json";
   handle = FileFindFirst(search_pattern, first_file, 0);
   
   if(handle == INVALID_HANDLE)
   {
      // Method 2: Try with FILE_COMMON as fallback
      handle = FileFindFirst(search_pattern, first_file, FILE_COMMON);
   }
   
   if(handle == INVALID_HANDLE)
   {
      // Method 3: Try backslash pattern without FILE_COMMON
      search_pattern = COMMANDS_DIR + "\\*.json";
      handle = FileFindFirst(search_pattern, first_file, 0);
   }
   
   if(handle == INVALID_HANDLE)
   {
      // Method 4: Try backslash pattern with FILE_COMMON
      handle = FileFindFirst(search_pattern, first_file, FILE_COMMON);
   }
   
   if(handle != INVALID_HANDLE)
   {
      Print("✅ Found command file: ", first_file);
      ProcessCommandFile(first_file);
      
      // Check for more files
      string next_file;
      while(FileFindNext(handle, next_file))
      {
         Print("✅ Found command file: ", next_file);
         ProcessCommandFile(next_file);
      }
      
      FileFindClose(handle);
      return; // Success - exit early
   }
   
   // Method 5: Direct file access - try to open files by checking recent timestamps
   // This is a fallback if FileFindFirst doesn't work in Wine
   if(scan_count == 1 || scan_count % 50 == 0) // Log every 50 scans (~25 seconds)
   {
      Print("🔍 FileFindFirst failed, trying direct file access (scan #", scan_count, ")...");
   }
   
   // Get current time in milliseconds (approximate)
   datetime current_time = TimeCurrent();
   long current_timestamp_ms = (long)current_time * 1000;
   
   // Check last 2 minutes of potential file timestamps (more focused range)
   // Check every 1 second for better performance (files are created every few seconds at most)
   // Start from current time and go back 2 minutes (120 seconds = 120000ms)
   for(long ts = current_timestamp_ms; ts > current_timestamp_ms - 120000; ts -= 1000)
   {
      for(int p = 0; p < ArraySize(command_prefixes); p++)
      {
         string test_filename = command_prefixes[p] + IntegerToString(ts) + ".json";
         
         // Try multiple path combinations
         string test_paths[];
         ArrayResize(test_paths, 4);
         test_paths[0] = COMMANDS_DIR + "/" + test_filename;
         test_paths[1] = COMMANDS_DIR + "\\" + test_filename;
         test_paths[2] = test_filename; // Try root directory
         test_paths[3] = "Files/" + COMMANDS_DIR + "/" + test_filename; // Try with Files prefix
         
         for(int path_idx = 0; path_idx < 4; path_idx++)
         {
            // Try without FILE_COMMON first
            int test_handle = FileOpen(test_paths[path_idx], FILE_READ|FILE_TXT|FILE_ANSI, 0);
            
            if(test_handle == INVALID_HANDLE)
            {
               // Try with FILE_COMMON
               test_handle = FileOpen(test_paths[path_idx], FILE_READ|FILE_TXT|FILE_ANSI|FILE_COMMON);
            }
            
            if(test_handle != INVALID_HANDLE)
            {
               FileClose(test_handle);
               Print("✅ Found file via direct access: ", test_filename, " (path: ", test_paths[path_idx], ")");
               ProcessCommandFile(test_filename);
               return; // Found and processed a file
            }
         }
      }
   }
   
   // Method 6: Try to find ANY .json file by checking if directory listing works
   // This is a last resort - try common patterns
   if(scan_count == 1 || scan_count % 100 == 0) // Log every 100 scans (~50 seconds)
   {
      Print("🔍 Direct timestamp scan failed. Checking if files exist in directory...");
      // Try to open a test file to verify directory is accessible
      string test_dir_file = COMMANDS_DIR + "/test_dir_check.tmp";
      int dir_test = FileOpen(test_dir_file, FILE_WRITE|FILE_TXT|FILE_ANSI, 0);
      if(dir_test == INVALID_HANDLE)
      {
         dir_test = FileOpen(test_dir_file, FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON);
      }
      if(dir_test != INVALID_HANDLE)
      {
         FileClose(dir_test);
         FileDelete(test_dir_file, 0);
         if(GetLastError() != 0) FileDelete(test_dir_file, FILE_COMMON);
         Print("✅ Directory is accessible, but FileFindFirst not working. Files may need to be accessed by exact name.");
      }
      else
      {
         Print("❌ Cannot access directory. Last error: ", GetLastError());
      }
   }
}

//+------------------------------------------------------------------+
//| Process a single command file                                    |
//+------------------------------------------------------------------+
void ProcessCommandFile(string filename)
{
   // Extract just filename if path included
   int last_slash = StringFind(filename, "\\", 0);
   if(last_slash < 0) last_slash = StringFind(filename, "/", 0);
   if(last_slash >= 0)
   {
      filename = StringSubstr(filename, last_slash + 1);
   }
   
   // Try to open file WITHOUT FILE_COMMON first (Wine compatibility)
   string filepath = COMMANDS_DIR + "/" + filename;
   int file_handle = FileOpen(filepath, FILE_READ|FILE_TXT|FILE_ANSI, 0);
   
   if(file_handle == INVALID_HANDLE)
   {
      // Try with FILE_COMMON as fallback
      file_handle = FileOpen(filepath, FILE_READ|FILE_TXT|FILE_ANSI|FILE_COMMON);
   }
   
   if(file_handle == INVALID_HANDLE)
   {
      Print("❌ Failed to open command file: ", filename);
      return;
   }
   
   // Read JSON content
   string json_content = "";
   while(!FileIsEnding(file_handle))
   {
      json_content += FileReadString(file_handle);
   }
   FileClose(file_handle);
   
   Print("📨 Processing command: ", filename);
   
   // Parse and process command
   string response = ProcessCommand(json_content);
   
   // Extract timestamp from filename for response filename
   int last_underscore = StringFind(filename, "_", StringFind(filename, "_") + 1);
   if(last_underscore < 0) last_underscore = StringFind(filename, "_");
   string timestamp_part = StringSubstr(filename, last_underscore + 1);
   int dot_pos = StringFind(timestamp_part, ".");
   if(dot_pos > 0) timestamp_part = StringSubstr(timestamp_part, 0, dot_pos);
   string response_filename = "response_" + timestamp_part + ".json";
   
   // Write response file - try WITHOUT FILE_COMMON first (Wine compatibility)
   string response_filepath = RESPONSES_DIR + "/" + response_filename;
   int response_handle = FileOpen(response_filepath, FILE_WRITE|FILE_TXT|FILE_ANSI, 0);
   
   if(response_handle == INVALID_HANDLE)
   {
      response_handle = FileOpen(response_filepath, FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON);
   }
   
   if(response_handle != INVALID_HANDLE)
   {
      FileWriteString(response_handle, response);
      FileClose(response_handle);
      Print("📤 Response written: ", response_filename);
   }
   else
   {
      Print("❌ Failed to write response: ", response_filename);
   }
   
   // Delete command file after processing - try WITHOUT FILE_COMMON first (Wine compatibility)
   if(!FileDelete(filepath, 0))
   {
      FileDelete(filepath, FILE_COMMON);
   }
   
   processed_files++;
}

//+------------------------------------------------------------------+
//| Process command JSON and return response                         |
//+------------------------------------------------------------------+
string ProcessCommand(string json)
{
   string command = ExtractJSONValue(json, "command");
   Print("🔍 Processing command: ", command);
   
   if(command == "get_account_info")
   {
      Print("📊 Getting account info...");
      return GetAccountInfoJSON();
   }
   else if(command == "get_symbol_price")
   {
      string symbol = ExtractJSONValue(json, "symbol");
      Print("💰 Getting price for: ", symbol);
      return GetSymbolPriceJSON(symbol);
   }
   else if(command == "execute_trade")
   {
      Print("🎯 Executing trade...");
      return ExecuteTradeJSON(json);
   }
   else if(command == "get_positions")
   {
      Print("📈 Getting open positions...");
      string result = GetPositionsJSON();
      Print("✅ Positions JSON generated, length: ", StringLen(result));
      return result;
   }
   else if(command == "get_deal_history")
   {
      Print("📜 Getting deal history...");
      return GetDealHistoryJSON();
   }
   else if(command == "get_closed_positions")
   {
      Print("📋 Getting closed positions...");
      string result = GetClosedPositionsJSON();
      Print("✅ Closed positions JSON generated, length: ", StringLen(result));
      return result;
   }
   else if(command == "get_historical_data")
   {
      string symbol = ExtractJSONValue(json, "symbol");
      string timeframe_str = ExtractJSONValue(json, "timeframe");
      string count_str = ExtractJSONValue(json, "count");
      
      int count = 100; // Default
      if(count_str != "")
      {
         count = (int)StringToInteger(count_str);
         if(count <= 0 || count > 1000) count = 100; // Limit to 1000 bars max
      }
      
      Print("📊 Getting historical data for: ", symbol, " timeframe: ", timeframe_str, " count: ", count);
      return GetHistoricalDataJSON(symbol, timeframe_str, count);
   }
   else
   {
      Print("❌ Unknown command: ", command);
      return "{\"success\": false, \"error\": \"Unknown command: " + command + "\"}";
   }
}

//+------------------------------------------------------------------+
//| Get account information as JSON                                 |
//+------------------------------------------------------------------+
string GetAccountInfoJSON()
{
   // Get account information
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double margin = AccountInfoDouble(ACCOUNT_MARGIN);
   double free_margin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   
   // Validate that we have valid account data
   if(balance <= 0)
   {
      Print("⚠️ WARNING: Account balance is 0 or invalid. Make sure EA is attached to a logged-in account.");
   }
   
   // Detect account type (demo or live)
   int trade_mode = (int)AccountInfoInteger(ACCOUNT_TRADE_MODE);
   string account_type = "live"; // Default to live
   if(trade_mode == ACCOUNT_TRADE_MODE_DEMO)
   {
      account_type = "demo";
   }
   else
   {
      // Also check server name as fallback (demo servers often contain "demo" or "Demo")
      string server_name = AccountInfoString(ACCOUNT_SERVER);
      StringToLower(server_name);
      if(StringFind(server_name, "demo") >= 0)
      {
         account_type = "demo";
      }
   }
   
   // Get account details
   string currency = AccountInfoString(ACCOUNT_CURRENCY);
   int leverage = (int)AccountInfoInteger(ACCOUNT_LEVERAGE);
   string server = AccountInfoString(ACCOUNT_SERVER);
   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   
   // Build JSON response - ensure all fields are properly formatted
   string json = "{";
   json += "\"success\": true,";
   json += "\"source\": \"REAL_MT5\",";
   json += "\"balance\": " + DoubleToString(balance, 2) + ",";
   json += "\"equity\": " + DoubleToString(equity, 2) + ",";
   json += "\"margin\": " + DoubleToString(margin, 2) + ",";
   json += "\"free_margin\": " + DoubleToString(free_margin, 2) + ",";
   json += "\"currency\": \"" + currency + "\",";
   json += "\"leverage\": " + IntegerToString(leverage) + ",";
   json += "\"server\": \"" + server + "\",";
   json += "\"login\": " + IntegerToString((int)login) + ",";
   json += "\"account_type\": \"" + account_type + "\",";
   json += "\"timestamp\": \"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\"";
   json += "}";
   
   Print("✅ Account Info: Balance=", balance, " Equity=", equity, " Login=", login);
   
   return json;
}

//+------------------------------------------------------------------+
//| Get symbol price as JSON                                        |
//+------------------------------------------------------------------+
string GetSymbolPriceJSON(string symbol)
{
   if(symbol == "") symbol = Symbol();
   
   // Ensure symbol is in Market Watch (required to get prices)
   if(!SymbolSelect(symbol, true))
   {
      // Try with common broker suffixes
      string suffixes[] = {"", ".raw", "m", ".pro", "_SB"};
      bool found = false;
      for(int i = 0; i < ArraySize(suffixes); i++)
      {
         string testSymbol = symbol + suffixes[i];
         if(SymbolSelect(testSymbol, true))
         {
            symbol = testSymbol;
            found = true;
            break;
         }
      }
      if(!found)
      {
         return "{\"success\": false, \"error\": \"Symbol not found: " + symbol + "\"}";
      }
   }
   
   // Wait briefly for price data to load
   int attempts = 0;
   while(SymbolInfoDouble(symbol, SYMBOL_BID) == 0 && attempts < 10)
   {
      Sleep(100);
      attempts++;
   }
   
   double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);
   
   if(bid == 0 || ask == 0)
   {
      return "{\"success\": false, \"error\": \"No price data for: " + symbol + "\"}";
   }
   
   double spread = SymbolInfoInteger(symbol, SYMBOL_SPREAD) * SymbolInfoDouble(symbol, SYMBOL_POINT);
   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   
   string json = "{";
   json += "\"success\": true,";
   json += "\"source\": \"REAL_MT5\",";
   json += "\"symbol\": \"" + symbol + "\",";
   json += "\"bid\": " + DoubleToString(bid, digits) + ",";
   json += "\"ask\": " + DoubleToString(ask, digits) + ",";
   json += "\"spread\": " + DoubleToString(spread, digits) + ",";
   json += "\"timestamp\": \"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\"";
   json += "}";
   
   return json;
}

//+------------------------------------------------------------------+
//| Get the correct filling mode for a symbol                       |
//+------------------------------------------------------------------+
ENUM_ORDER_TYPE_FILLING GetFillingMode(string symbol)
{
   // Get the filling mode flags supported by the symbol
   uint filling = (uint)SymbolInfoInteger(symbol, SYMBOL_FILLING_MODE);
   
   // Check which modes are supported (in order of preference)
   if((filling & SYMBOL_FILLING_IOC) == SYMBOL_FILLING_IOC)
      return ORDER_FILLING_IOC;
   
   if((filling & SYMBOL_FILLING_FOK) == SYMBOL_FILLING_FOK)
      return ORDER_FILLING_FOK;
   
   // Return (default for some brokers)
   return ORDER_FILLING_RETURN;
}

//+------------------------------------------------------------------+
//| Execute trade from JSON                                         |
//+------------------------------------------------------------------+
string ExecuteTradeJSON(string json)
{
   string symbol = ExtractJSONValue(json, "symbol");
   string action = ExtractJSONValue(json, "action"); // "BUY" or "SELL"
   string volume_str = ExtractJSONValue(json, "volume");
   string sl_str = ExtractJSONValue(json, "sl");
   string tp_str = ExtractJSONValue(json, "tp");
   
   // Also check in "data" object
   if(symbol == "")
   {
      string data_str = ExtractJSONValue(json, "data");
      if(data_str != "")
      {
         symbol = ExtractJSONValue(data_str, "symbol");
         action = ExtractJSONValue(data_str, "action");
         volume_str = ExtractJSONValue(data_str, "volume");
         sl_str = ExtractJSONValue(data_str, "sl");
         tp_str = ExtractJSONValue(data_str, "tp");
      }
   }
   
   if(symbol == "" || action == "" || volume_str == "")
   {
      return "{\"success\": false, \"error\": \"Missing required parameters\"}";
   }
   
   // Ensure symbol is in Market Watch
   if(!SymbolSelect(symbol, true))
   {
      // Try with common broker suffixes
      string suffixes[] = {"", ".raw", "m", ".pro", "_SB"};
      bool found = false;
      for(int i = 0; i < ArraySize(suffixes); i++)
      {
         string testSymbol = symbol + suffixes[i];
         if(SymbolSelect(testSymbol, true))
         {
            symbol = testSymbol;
            found = true;
            break;
         }
      }
      if(!found)
      {
         return "{\"success\": false, \"error\": \"Symbol not found: " + symbol + "\"}";
      }
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
   
   // Get the correct filling mode for this symbol
   ENUM_ORDER_TYPE_FILLING filling_mode = GetFillingMode(symbol);
   
   if(action == "BUY")
   {
      request.type = ORDER_TYPE_BUY;
      request.price = SymbolInfoDouble(symbol, SYMBOL_ASK);
      request.type_filling = filling_mode;
   }
   else if(action == "SELL")
   {
      request.type = ORDER_TYPE_SELL;
      request.price = SymbolInfoDouble(symbol, SYMBOL_BID);
      request.type_filling = filling_mode;
   }
   else
   {
      return "{\"success\": false, \"error\": \"Invalid action: " + action + "\"}";
   }
   
   // Send trade request
   bool success = OrderSend(request, result);
   
   if(success && result.retcode == TRADE_RETCODE_DONE)
   {
      int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
      string response = "{";
      response += "\"success\": true,";
      response += "\"source\": \"REAL_MT5\",";
      response += "\"order_id\": \"" + IntegerToString(result.order) + "\",";
      response += "\"deal_id\": \"" + IntegerToString(result.deal) + "\",";
      response += "\"volume\": " + DoubleToString(result.volume, 2) + ",";
      response += "\"price\": " + DoubleToString(result.price, digits) + ",";
      response += "\"symbol\": \"" + symbol + "\",";
      response += "\"action\": \"" + action + "\",";
      response += "\"message\": \"Trade executed successfully\",";
      response += "\"timestamp\": \"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\"";
      response += "}";
      return response;
   }
   else
   {
      return "{\"success\": false, \"error\": \"Trade failed: " + IntegerToString(result.retcode) + " - " + result.comment + "\"}";
   }
}

//+------------------------------------------------------------------+
//| Get open positions as JSON                                      |
//+------------------------------------------------------------------+
string GetPositionsJSON()
{
   string json = "{\"success\": true, \"source\": \"REAL_MT5\", \"positions\": [";
   
   int total = PositionsTotal();
   Print("📊 Total positions: ", total);
   
   int position_count = 0;
   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0)
      {
         Print("⚠️ Failed to get position ticket at index: ", i);
         continue;
      }
      
      if(!PositionSelectByTicket(ticket))
      {
         Print("⚠️ Failed to select position by ticket: ", ticket);
         continue;
      }
      
      if(ticket > 0)
      {
         if(position_count > 0) json += ",";
         
         datetime open_time = (datetime)PositionGetInteger(POSITION_TIME);
         double sl = PositionGetDouble(POSITION_SL);
         double tp = PositionGetDouble(POSITION_TP);
         
         json += "{";
         json += "\"ticket\": " + IntegerToString((int)ticket) + ",";
         json += "\"symbol\": \"" + PositionGetString(POSITION_SYMBOL) + "\",";
         json += "\"type\": \"" + (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? "BUY" : "SELL") + "\",";
         json += "\"direction\": \"" + (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? "BUY" : "SELL") + "\",";
         json += "\"volume\": " + DoubleToString(PositionGetDouble(POSITION_VOLUME), 2) + ",";
         json += "\"open_price\": " + DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN), 5) + ",";
         json += "\"entryPrice\": " + DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN), 5) + ",";
         json += "\"sl\": " + (sl > 0 ? DoubleToString(sl, 5) : "0") + ",";
         json += "\"stopLoss\": " + (sl > 0 ? DoubleToString(sl, 5) : "0") + ",";
         json += "\"tp\": " + (tp > 0 ? DoubleToString(tp, 5) : "0") + ",";
         json += "\"takeProfit\": " + (tp > 0 ? DoubleToString(tp, 5) : "0") + ",";
         json += "\"profit\": " + DoubleToString(PositionGetDouble(POSITION_PROFIT), 2) + ",";
         json += "\"profitLoss\": " + DoubleToString(PositionGetDouble(POSITION_PROFIT), 2) + ",";
         json += "\"openTime\": \"" + TimeToString(open_time, TIME_DATE|TIME_SECONDS) + "\",";
         json += "\"open_time\": \"" + TimeToString(open_time, TIME_DATE|TIME_SECONDS) + "\"";
         json += "}";
         
         position_count++;
         Print("✅ Position ", position_count, ": ", PositionGetString(POSITION_SYMBOL), " Ticket: ", ticket);
      }
   }
   
   json += "], \"total\": " + IntegerToString(position_count) + ", \"timestamp\": \"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\"}";
   Print("📤 Returning positions JSON with ", position_count, " positions");
   return json;
}

//+------------------------------------------------------------------+
//| Get deal history as JSON                                         |
//+------------------------------------------------------------------+
string GetDealHistoryJSON()
{
   // Select history for the current account
   if(!HistorySelect(0, TimeCurrent()))
   {
      return "{\"success\": false, \"error\": \"Failed to select history\"}";
   }
   
   int total = HistoryDealsTotal();
   string json = "{\"success\": true, \"source\": \"REAL_MT5\", \"deals\": [";
   
   int count = 0;
   // Get last 100 deals (or all if less)
   int start = total > 100 ? total - 100 : 0;
   
   for(int i = start; i < total; i++)
   {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket > 0)
      {
         // Only include position closing deals (DEAL_TYPE_BALANCE, DEAL_TYPE_COMMISSION, DEAL_TYPE_BUY, DEAL_TYPE_SELL)
         ENUM_DEAL_TYPE deal_type = (ENUM_DEAL_TYPE)HistoryDealGetInteger(ticket, DEAL_TYPE);
         
         // Skip balance and commission deals, focus on position entries/exits
         if(deal_type == DEAL_TYPE_BALANCE || deal_type == DEAL_TYPE_COMMISSION || deal_type == DEAL_TYPE_COMMISSION_DAILY)
            continue;
         
         if(count > 0) json += ",";
         
         string symbol = HistoryDealGetString(ticket, DEAL_SYMBOL);
         double volume = HistoryDealGetDouble(ticket, DEAL_VOLUME);
         double price = HistoryDealGetDouble(ticket, DEAL_PRICE);
         double profit = HistoryDealGetDouble(ticket, DEAL_PROFIT);
         double swap = HistoryDealGetDouble(ticket, DEAL_SWAP);
         double commission = HistoryDealGetDouble(ticket, DEAL_COMMISSION);
         datetime time = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
         ulong position_id = HistoryDealGetInteger(ticket, DEAL_POSITION_ID);
         
         json += "{";
         json += "\"ticket\": " + IntegerToString((int)ticket) + ",";
         json += "\"position_id\": " + IntegerToString((int)position_id) + ",";
         json += "\"symbol\": \"" + symbol + "\",";
         json += "\"type\": \"" + (deal_type == DEAL_TYPE_BUY ? "BUY" : "SELL") + "\",";
         json += "\"volume\": " + DoubleToString(volume, 2) + ",";
         json += "\"price\": " + DoubleToString(price, 5) + ",";
         json += "\"profit\": " + DoubleToString(profit, 2) + ",";
         json += "\"swap\": " + DoubleToString(swap, 2) + ",";
         json += "\"commission\": " + DoubleToString(commission, 2) + ",";
         json += "\"time\": \"" + TimeToString(time, TIME_DATE|TIME_SECONDS) + "\"";
         json += "}";
         
         count++;
      }
   }
   
   json += "], \"total\": " + IntegerToString(count) + ", \"timestamp\": \"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\"}";
   return json;
}

//+------------------------------------------------------------------+
//| Get closed positions as JSON (grouped deals)                    |
//+------------------------------------------------------------------+
string GetClosedPositionsJSON()
{
   Print("📋 Starting closed positions scan...");
   
   if(!HistorySelect(0, TimeCurrent()))
   {
      Print("❌ Failed to select history");
      return "{\"success\": false, \"error\": \"Failed to select history\"}";
   }
   
   int total = HistoryDealsTotal();
   Print("📊 Total deals in history: ", total);
   
   // Limit to last 500 deals to avoid timeout
   int start_index = total > 500 ? total - 500 : 0;
   int deals_to_process = total - start_index;
   
   Print("📊 Processing last ", deals_to_process, " deals (from index ", start_index, ")");
   
   string json = "{\"success\": true, \"source\": \"REAL_MT5\", \"positions\": [";
   
   // Use arrays to store position data
   ulong position_ids[];
   string position_symbols[];
   string position_directions[];
   double position_volumes[];
   double position_entry_prices[];
   double position_exit_prices[];
   double position_profits[];
   double position_swaps[];
   double position_commissions[];
   datetime position_open_times[];
   datetime position_close_times[];
   
   ArrayResize(position_ids, 0);
   ArrayResize(position_symbols, 0);
   ArrayResize(position_directions, 0);
   ArrayResize(position_volumes, 0);
   ArrayResize(position_entry_prices, 0);
   ArrayResize(position_exit_prices, 0);
   ArrayResize(position_profits, 0);
   ArrayResize(position_swaps, 0);
   ArrayResize(position_commissions, 0);
   ArrayResize(position_open_times, 0);
   ArrayResize(position_close_times, 0);
   
   // Single pass: collect all position data
   for(int i = start_index; i < total; i++)
   {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket <= 0) continue;
      
      ulong position_id = HistoryDealGetInteger(ticket, DEAL_POSITION_ID);
      if(position_id == 0) continue;
      
      ENUM_DEAL_TYPE deal_type = (ENUM_DEAL_TYPE)HistoryDealGetInteger(ticket, DEAL_TYPE);
      datetime deal_time = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
      double deal_profit = HistoryDealGetDouble(ticket, DEAL_PROFIT);
      double deal_swap = HistoryDealGetDouble(ticket, DEAL_SWAP);
      double deal_commission = HistoryDealGetDouble(ticket, DEAL_COMMISSION);
      
      // Find if this position_id already exists
      int pos_index = -1;
      for(int j = 0; j < ArraySize(position_ids); j++)
      {
         if(position_ids[j] == position_id)
         {
            pos_index = j;
            break;
         }
      }
      
      if(pos_index == -1)
      {
         // New position - only create if it's a BUY/SELL deal (entry)
         if(deal_type == DEAL_TYPE_BUY || deal_type == DEAL_TYPE_SELL)
         {
            int new_size = ArraySize(position_ids) + 1;
            ArrayResize(position_ids, new_size);
            ArrayResize(position_symbols, new_size);
            ArrayResize(position_directions, new_size);
            ArrayResize(position_volumes, new_size);
            ArrayResize(position_entry_prices, new_size);
            ArrayResize(position_exit_prices, new_size);
            ArrayResize(position_profits, new_size);
            ArrayResize(position_swaps, new_size);
            ArrayResize(position_commissions, new_size);
            ArrayResize(position_open_times, new_size);
            ArrayResize(position_close_times, new_size);
            
            pos_index = new_size - 1;
            position_ids[pos_index] = position_id;
            position_symbols[pos_index] = HistoryDealGetString(ticket, DEAL_SYMBOL);
            position_directions[pos_index] = (deal_type == DEAL_TYPE_BUY ? "BUY" : "SELL");
            position_volumes[pos_index] = HistoryDealGetDouble(ticket, DEAL_VOLUME);
            position_entry_prices[pos_index] = HistoryDealGetDouble(ticket, DEAL_PRICE);
            position_exit_prices[pos_index] = 0;
            position_profits[pos_index] = deal_profit;
            position_swaps[pos_index] = deal_swap;
            position_commissions[pos_index] = deal_commission;
            position_open_times[pos_index] = deal_time;
            position_close_times[pos_index] = 0;
         }
      }
      else
      {
         // Existing position - accumulate profit/swap/commission
         position_profits[pos_index] += deal_profit;
         position_swaps[pos_index] += deal_swap;
         position_commissions[pos_index] += deal_commission;
         
         // If this is an exit deal, update exit info
         if((deal_type == DEAL_TYPE_BUY || deal_type == DEAL_TYPE_SELL) && 
            deal_time > position_open_times[pos_index] && 
            position_exit_prices[pos_index] == 0)
         {
            position_exit_prices[pos_index] = HistoryDealGetDouble(ticket, DEAL_PRICE);
            position_close_times[pos_index] = deal_time;
         }
      }
   }
   
   Print("📊 Found ", ArraySize(position_ids), " unique positions");
   
   // Build JSON response - only include closed positions
   int closed_count = 0;
   for(int i = 0; i < ArraySize(position_ids); i++)
   {
      if(position_exit_prices[i] > 0 && position_close_times[i] > 0)
      {
         if(closed_count > 0) json += ",";
         
         json += "{";
         json += "\"position_id\": " + IntegerToString((int)position_ids[i]) + ",";
         json += "\"symbol\": \"" + position_symbols[i] + "\",";
         json += "\"direction\": \"" + position_directions[i] + "\",";
         json += "\"volume\": " + DoubleToString(position_volumes[i], 2) + ",";
         json += "\"entry_price\": " + DoubleToString(position_entry_prices[i], 5) + ",";
         json += "\"exit_price\": " + DoubleToString(position_exit_prices[i], 5) + ",";
         json += "\"profit\": " + DoubleToString(position_profits[i], 2) + ",";
         json += "\"swap\": " + DoubleToString(position_swaps[i], 2) + ",";
         json += "\"commission\": " + DoubleToString(position_commissions[i], 2) + ",";
         json += "\"open_time\": \"" + TimeToString(position_open_times[i], TIME_DATE|TIME_SECONDS) + "\",";
         json += "\"close_time\": \"" + TimeToString(position_close_times[i], TIME_DATE|TIME_SECONDS) + "\"";
         json += "}";
         
         closed_count++;
      }
   }
   
   Print("✅ Found ", closed_count, " closed positions");
   
   json += "], \"total\": " + IntegerToString(closed_count) + ", \"timestamp\": \"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\"}";
   return json;
}

//+------------------------------------------------------------------+
//| Get historical price data as JSON                               |
//+------------------------------------------------------------------+
string GetHistoricalDataJSON(string symbol, string timeframe_str, int count)
{
   if(symbol == "") symbol = Symbol();
   
   // Ensure symbol is in Market Watch
   if(!SymbolSelect(symbol, true))
   {
      // Try with common broker suffixes
      string suffixes[] = {"", ".raw", "m", ".pro", "_SB"};
      bool found = false;
      for(int i = 0; i < ArraySize(suffixes); i++)
      {
         string testSymbol = symbol + suffixes[i];
         if(SymbolSelect(testSymbol, true))
         {
            symbol = testSymbol;
            found = true;
            break;
         }
      }
      if(!found)
      {
         return "{\"success\": false, \"error\": \"Symbol not found: " + symbol + "\"}";
      }
   }
   
   // Convert timeframe string to ENUM_TIMEFRAMES
   ENUM_TIMEFRAMES timeframe = PERIOD_H1; // Default to H1
   
   if(timeframe_str == "M1") timeframe = PERIOD_M1;
   else if(timeframe_str == "M5") timeframe = PERIOD_M5;
   else if(timeframe_str == "M15") timeframe = PERIOD_M15;
   else if(timeframe_str == "M30") timeframe = PERIOD_M30;
   else if(timeframe_str == "H1") timeframe = PERIOD_H1;
   else if(timeframe_str == "H4") timeframe = PERIOD_H4;
   else if(timeframe_str == "D1") timeframe = PERIOD_D1;
   
   // Copy rates from MT5
   MqlRates rates[];
   int copied = CopyRates(symbol, timeframe, 0, count, rates);
   
   if(copied <= 0)
   {
      return "{\"success\": false, \"error\": \"Failed to copy rates for " + symbol + "\"}";
   }
   
   Print("✅ Copied ", copied, " bars for ", symbol, " on ", timeframe_str);
   
   // Build JSON response
   string json = "{";
   json += "\"success\": true,";
   json += "\"source\": \"REAL_MT5\",";
   json += "\"symbol\": \"" + symbol + "\",";
   json += "\"timeframe\": \"" + timeframe_str + "\",";
   json += "\"count\": " + IntegerToString(copied) + ",";
   json += "\"data\": [";
   
   // Add bars (oldest first, newest last)
   for(int i = 0; i < copied; i++)
   {
      if(i > 0) json += ",";
      
      json += "{";
      json += "\"timestamp\": \"" + TimeToString(rates[i].time, TIME_DATE|TIME_SECONDS) + "\",";
      json += "\"open\": " + DoubleToString(rates[i].open, 5) + ",";
      json += "\"high\": " + DoubleToString(rates[i].high, 5) + ",";
      json += "\"low\": " + DoubleToString(rates[i].low, 5) + ",";
      json += "\"close\": " + DoubleToString(rates[i].close, 5) + ",";
      json += "\"volume\": " + IntegerToString((int)rates[i].tick_volume);
      json += "}";
   }
   
   json += "], \"timestamp\": \"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\"}";
   
   return json;
}

//+------------------------------------------------------------------+
//| Extract value from simple JSON string                           |
//+------------------------------------------------------------------+
string ExtractJSONValue(string json, string key)
{
   string search = "\"" + key + "\":";
   int start = StringFind(json, search);
   if(start == -1) return "";
   
   start += StringLen(search);
   
   // Skip whitespace
   while(start < StringLen(json) && (StringGetCharacter(json, start) == ' ' || StringGetCharacter(json, start) == '\t'))
      start++;
   
   // Check if value is a string (starts with quote)
   if(StringGetCharacter(json, start) == '"')
   {
      start++; // Skip opening quote
      int end = StringFind(json, "\"", start);
      if(end == -1) return "";
      return StringSubstr(json, start, end - start);
   }
   else
   {
      // Number or boolean
      int end = StringFind(json, ",", start);
      if(end == -1) end = StringFind(json, "}", start);
      if(end == -1) return "";
      
      string value = StringSubstr(json, start, end - start);
      // Remove leading/trailing whitespace manually
      int len = StringLen(value);
      int left = 0, right = len - 1;
      
      // Find first non-whitespace from left
      while(left < len && (StringGetCharacter(value, left) == ' ' || StringGetCharacter(value, left) == '\t'))
         left++;
      
      // Find first non-whitespace from right
      while(right >= left && (StringGetCharacter(value, right) == ' ' || StringGetCharacter(value, right) == '\t'))
         right--;
      
      if(left > right) return "";
      return StringSubstr(value, left, right - left + 1);
   }
}
