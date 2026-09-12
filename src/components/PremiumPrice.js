import React, { useEffect, useState } from "react";
import { getPaddle, paddleConfigured, PREMIUM_PRICE_ID } from "../api/paddle";

export default function PremiumPrice() {
  const [price, setPrice] = useState(null);
  useEffect(() => {
    let active = true;
    if (paddleConfigured) getPaddle()
      .then(paddle => paddle.PricePreview({ items: [{ priceId: PREMIUM_PRICE_ID, quantity: 1 }] }))
      .then(result => {
        const item = result.data.details.lineItems.find(line => line.price.id === PREMIUM_PRICE_ID);
        if (active) setPrice(item?.formattedTotals?.total || null);
      }).catch(() => {}); // Checkout still works if preview is unavailable.
    return () => { active = false; };
  }, []);
  return <p>{price ? `${price} / месяц` : "Стоимость в вашей валюте будет показана в Paddle Checkout."} Без пробного периода.</p>;
}
