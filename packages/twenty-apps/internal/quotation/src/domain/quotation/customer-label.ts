// The customer of a quotation is a person OR a company, so its readable name is
// derived from whichever relation is populated — never stored as typed text.
//
// ONE precedence rule for every surface (customer page, list table, PDF): the
// person name wins when both relations somehow carry a value, because customerType
// PERSON is the more specific claim.
export type QuotationCustomerSource = {
  person: {
    name: {
      firstName?: string | null;
      lastName?: string | null;
    } | null;
  } | null;
  company: { name: string | null } | null;
};

export const buildQuotationCustomerLabel = ({
  person,
  company,
}: QuotationCustomerSource): string | null => {
  const personFirst = person?.name?.firstName?.trim() ?? '';
  const personLast = person?.name?.lastName?.trim() ?? '';
  const personLabel = `${personFirst} ${personLast}`.trim();

  if (personLabel !== '') {
    return personLabel;
  }

  const companyLabel = company?.name?.trim() ?? '';

  return companyLabel === '' ? null : companyLabel;
};
