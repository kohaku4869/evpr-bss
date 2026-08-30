// Placeholder fare estimate for the booking form — presentational only, not a
// real pricing engine (there is no backend behind the customer flow).
export function estimateFare(serviceType, form) {
  const base = { package: 12000, ride: 15000, food: 18000 }[serviceType] ?? 15000;

  let extra = 0;
  if (serviceType === 'package') {
    extra = Math.round((Number(form.weight) || 0) * 3000);
  } else if (serviceType === 'ride') {
    extra = (Number(form.passengers || 1) - 1) * 5000;
  } else if (serviceType === 'food') {
    extra = 8000;
  }

  return `${(base + extra).toLocaleString('vi-VN')}đ`;
}
