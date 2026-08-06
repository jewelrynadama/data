export interface MetaAdCampaign {
  id: string;
  name: string;
  budget: number;
  status: 'active' | 'paused' | 'completed' | 'draft';
  platform: 'instagram' | 'facebook';
  clicks: number;
  spent: number;
  leads: number;
  sales: number;
}

export async function fetchMetaCampaigns(accountId: string, accessToken: string): Promise<MetaAdCampaign[]> {
  if (!accountId || !accessToken) {
    throw new Error('Meta Access Token dan Ad Account ID diperlukan.');
  }

  // Ensure accountId starts with 'act_'
  const formattedAccountId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  
  // API URL
  const url = `https://graph.facebook.com/v19.0/${formattedAccountId}/campaigns?fields=id,name,status,daily_budget,lifetime_budget,insights{clicks,spend,actions}&access_token=${accessToken}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'Gagal menarik data dari Meta API');
    }

    const campaigns: MetaAdCampaign[] = [];

    for (const item of data.data) {
      // Parse budget
      const budget = item.daily_budget ? parseInt(item.daily_budget, 10) / 100 
                   : item.lifetime_budget ? parseInt(item.lifetime_budget, 10) / 100 
                   : 0;

      // Parse status
      let mappedStatus: 'active' | 'paused' | 'completed' | 'draft' = 'draft';
      const metaStatus = (item.status || '').toUpperCase();
      if (metaStatus === 'ACTIVE') mappedStatus = 'active';
      else if (metaStatus === 'PAUSED') mappedStatus = 'paused';
      else if (metaStatus === 'COMPLETED') mappedStatus = 'completed';

      // Parse Insights
      let clicks = 0;
      let spent = 0;
      let leads = 0;
      let sales = 0; // value of purchases

      if (item.insights && item.insights.data && item.insights.data.length > 0) {
        const insight = item.insights.data[0];
        clicks = parseInt(insight.clicks || '0', 10);
        spent = parseFloat(insight.spend || '0');

        if (insight.actions) {
          for (const action of insight.actions) {
            if (action.action_type === 'lead') {
              leads += parseInt(action.value || '0', 10);
            }
          }
        }
      }

      campaigns.push({
        id: item.id,
        name: item.name,
        budget,
        status: mappedStatus,
        platform: 'instagram', // Default assumption, Meta API requires deeper query for exact placement
        clicks,
        spent,
        leads,
        sales, // For simple tracking, Meta sales mapping can be complex (purchase value), we default to 0 and let users adjust if needed, or we just pull it if available.
      });
    }

    return campaigns;

  } catch (err: any) {
    console.error("Meta API Error:", err);
    throw new Error(err.message || 'Terjadi kesalahan jaringan.');
  }
}
