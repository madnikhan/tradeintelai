import { promises as fs } from 'fs';
import path from 'path';

export class FileBridgeConnector {
  private basePath = './mt5-commands';
  private responsePath = './mt5-responses';
  private timeout = 10000; // 10 seconds timeout

  async connect(): Promise<boolean> {
    // File bridge is always "connected"
    return true;
  }

  async getAccountInfo(): Promise<any> {
    return await this.sendCommand({
      command: 'get_account_info'
    });
  }

  async getMarketData(symbol: string): Promise<any> {
    return await this.sendCommand({
      command: 'get_symbol_price',
      symbol: symbol
    });
  }

  async executeTrade(trade: {
    symbol: string;
    type: 'BUY' | 'SELL';
    volume: number;
    stopLoss?: number;
    takeProfit?: number;
  }): Promise<any> {
    return await this.sendCommand({
      command: 'execute_trade',
      symbol: trade.symbol,
      action: trade.type,
      volume: trade.volume,
      sl: trade.stopLoss,
      tp: trade.takeProfit
    });
  }

  async getPositions(): Promise<any> {
    return await this.sendCommand({
      command: 'get_positions'
    });
  }

  private async sendCommand(commandData: any): Promise<any> {
    const timestamp = Date.now();
    const commandId = `command_${timestamp}.json`;
    const responseId = `response_${timestamp}.json`;
    
    // Use absolute paths from project root
    const projectRoot = process.cwd();
    const commandPath = path.join(projectRoot, this.basePath, commandId);
    const responsePath = path.join(projectRoot, this.responsePath, responseId);

    try {
      // Ensure directories exist
      await fs.mkdir(path.join(projectRoot, this.basePath), { recursive: true });
      await fs.mkdir(path.join(projectRoot, this.responsePath), { recursive: true });

      // Write command file
      await fs.writeFile(commandPath, JSON.stringify(commandData, null, 2));
      console.log(`📨 Command sent: ${commandId}`);

      // Wait for response
      const startTime = Date.now();
      while (Date.now() - startTime < this.timeout) {
        try {
          const responseData = await fs.readFile(responsePath, 'utf8');
          const response = JSON.parse(responseData);
          
          // Clean up response file
          await fs.unlink(responsePath);
          
          console.log(`📤 Response received: ${responseId}`);
          return response;
        } catch (error: any) {
          // File doesn't exist yet, wait and retry
          if (error.code === 'ENOENT') {
            await new Promise(resolve => setTimeout(resolve, 100));
          } else {
            throw error;
          }
        }
      }

      // Clean up command file if timeout
      try {
        await fs.unlink(commandPath);
      } catch {
        // Ignore cleanup errors
      }

      throw new Error('Response timeout');
      
    } catch (error) {
      console.error('File bridge error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const fileBridge = new FileBridgeConnector();

