// app/api/_lib/barcode.ts
export async function lookupBarcode(barcode: string) {
  const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("バーコードAPIへの接続に失敗しました");

  const data = await res.json();

  if (data.status === 0) {
    return {
      found: false,
      name: null,
      brand: null,
      image: null,
    };
  }

  return {
    found: true,
    name: data.product.product_name || "不明な商品",
    brand: data.product.brands || null,
    image: data.product.image_small_url || null,
  };
}
