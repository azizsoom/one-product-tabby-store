export function calculateOrder(input: any) {
  const vatRate = input.vatRate ?? 0.15;
  const quantity = Math.max(1, input.quantity || 1);
  const price = Math.max(0, input.unitPriceBeforeVat || 0);
  const subtotalBeforeDiscount = roundMoney(price * quantity);
  let discountAmount = 0;

  if (input.discount) {
    if (input.discount.type === 'fixed') {
      discountAmount = Math.max(0, input.discount.value || 0);
    } else {
      discountAmount = subtotalBeforeDiscount * (Math.max(0, input.discount.value || 0) / 100);
      if (typeof input.discount.maxAmount === 'number') {
        discountAmount = Math.min(discountAmount, Math.max(0, input.discount.maxAmount));
      }
    }
  }

  discountAmount = roundMoney(Math.min(subtotalBeforeDiscount, discountAmount));
  const taxableAmount = roundMoney(subtotalBeforeDiscount - discountAmount);
  const vatAmount = roundMoney(taxableAmount * vatRate);
  const totalAmount = roundMoney(taxableAmount + vatAmount);

  return { subtotalBeforeDiscount, discountAmount, taxableAmount, vatRate, vatAmount, totalAmount };
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
