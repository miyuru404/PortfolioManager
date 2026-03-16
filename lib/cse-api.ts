const BASE_URL = "https://www.cse.lk/api/";

async function csePost(endpoint: string, data: Record<string, string> = {}) {
  const form = new URLSearchParams(data);
  const res = await fetch(BASE_URL + endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`CSE API error: ${res.status}`);
  return res.json();
}

export async function getCompanyInfo(symbol: string) {
  const data = await csePost("companyInfoSummery", { symbol });
  return data;
}

export async function getTradeSummary() {
  const data = await csePost("tradeSummary");
  return data;
}

export async function getMarketStatus() {
  const data = await csePost("marketStatus");
  return data;
}

export async function getMarketSummary() {
  const data = await csePost("marketSummery");
  return data;
}

export async function getTopGainers() {
  const data = await csePost("topGainers");
  return data;
}

export async function getTopLosers() {
  const data = await csePost("topLooses");
  return data;
}

export async function getMostActive() {
  const data = await csePost("mostActiveTrades");
  return data;
}

export async function getChartData(symbol: string, chartId: string, period: string) {
  const data = await csePost("chartData", { symbol, chartId, period });
  return data;
}

export async function getAllSectors() {
  const data = await csePost("allSectors");
  return data;
}

export async function searchBySymbol(symbol: string) {
  try {
    const data = await csePost("companyInfoSummery", { symbol });
    if (data?.reqSymbolInfo) {
      return {
        symbol: data.reqSymbolInfo.symbol,
        name: data.reqSymbolInfo.name,
        lastTradedPrice: data.reqSymbolInfo.lastTradedPrice,
        change: data.reqSymbolInfo.change,
        changePercentage: data.reqSymbolInfo.changePercentage,
        marketCap: data.reqSymbolInfo.marketCap,
      };
    }
    return null;
  } catch {
    return null;
  }
}
