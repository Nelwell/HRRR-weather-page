export async function handler(event) {
    try {
      const p = event.queryStringParameters || {};
      const model = (p.model || "hrrr").toLowerCase();
      const area  = (p.area  || "conus").toLowerCase();
      const cycle = String(p.cycle || "").padStart(2, "0");
      const fhr   = String(p.fhr   || "0").padStart(3, "0");
      const param = (p.param || "ceiling").toLowerCase();
      const size  = (p.size  || "");
  
      const filename = `${model}_${area}_${fhr}00_${param}${size}.gif`;
      const remote = `https://mag.ncep.noaa.gov/data/${model}${cycle}/${filename}`;
  
      const resp = await fetch(remote, {
        headers: {
          "Referer": "https://mag.ncep.noaa.gov/",
          "User-Agent": "Mozilla/5.0 NetlifyFunction",
          "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
        }
      });
  
      if (!resp.ok) {
        const text = await resp.text();
        return { statusCode: resp.status, body: text };
      }
  
      const ab  = await resp.arrayBuffer();
      const buf = Buffer.from(ab);
  
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "image/gif",
          "Cache-Control": "public, max-age=300",
          "Access-Control-Allow-Origin": "*"
        },
        body: buf.toString("base64"),
        isBase64Encoded: true
      };
    } catch (err) {
      return { statusCode: 500, body: String(err) };
    }
  }
  