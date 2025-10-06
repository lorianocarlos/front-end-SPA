import dayjs from 'dayjs';

export const formatDate = (value?: string, withTime = false) => {
  if (!value) return '-';
  const parsed = dayjs(value);
  if (!parsed.isValid()) return value;
  return withTime ? parsed.format('DD/MM/YYYY HH:mm') : parsed.format('DD/MM/YYYY');
};

export const formatCurrency = (value?: number) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '0';
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};
