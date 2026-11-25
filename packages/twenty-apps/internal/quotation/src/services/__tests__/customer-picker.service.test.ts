import { describe, expect, it, vi } from 'vitest';

import { CUSTOMER_PICKER_PAGE_SIZE } from 'src/data/customer-queries';
import { RecordApiError } from 'src/data/record-api';
import {
  parseCustomerPickerPage,
  searchCustomersForPicker,
  verifyCustomerRecord,
} from 'src/services/customer-picker.service';

describe('customer-picker.service', () => {
  it('reads a person row through the composite name', () => {
    const page = parseCustomerPickerPage(
      {
        people: {
          edges: [
            {
              node: {
                id: 'person-1',
                name: { firstName: 'سارا', lastName: 'احمدی' },
                jobTitle: 'مدیر خرید',
                emails: { primaryEmail: 'sara@example.com' },
              },
            },
          ],
          pageInfo: { hasNextPage: false },
        },
      },
      'PERSON',
    );

    expect(page.rows).toEqual([
      { id: 'person-1', label: 'سارا احمدی', detail: 'مدیر خرید' },
    ]);
  });

  it('falls back to the email when a person has no job title', () => {
    const page = parseCustomerPickerPage(
      {
        people: {
          edges: [
            {
              node: {
                id: 'person-2',
                name: { firstName: 'علی', lastName: 'رضایی' },
                emails: { primaryEmail: 'ali@example.com' },
              },
            },
          ],
          pageInfo: { hasNextPage: true },
        },
      },
      'PERSON',
    );

    expect(page.rows[0]?.detail).toBe('ali@example.com');
    expect(page.hasNextPage).toBe(true);
  });

  it('keeps a nameless person selectable instead of hiding a real record', () => {
    const page = parseCustomerPickerPage(
      {
        people: {
          edges: [{ node: { id: 'person-3', name: {} } }],
          pageInfo: { hasNextPage: false },
        },
      },
      'PERSON',
    );

    expect(page.rows).toEqual([
      { id: 'person-3', label: 'شخص بدون نام', detail: null },
    ]);
  });

  it('reads a company row by its single name field', () => {
    const page = parseCustomerPickerPage(
      {
        companies: {
          edges: [{ node: { id: 'company-1', name: 'شرکت نمونه' } }],
          pageInfo: { hasNextPage: false },
        },
      },
      'COMPANY',
    );

    expect(page.rows).toEqual([
      { id: 'company-1', label: 'شرکت نمونه', detail: null },
    ]);
  });

  it('returns no rows for a malformed payload instead of throwing', () => {
    expect(parseCustomerPickerPage({}, 'COMPANY')).toEqual({
      rows: [],
      hasNextPage: false,
      endCursor: null,
      totalKnown: null,
    });
  });

  it('keeps the first customer page at most 100 rows', () => {
    expect(CUSTOMER_PICKER_PAGE_SIZE).toBe(100);
  });

  it('pages with the cursor the server issued so the next page continues the same order', async () => {
    const execute = vi.fn(async (_query: string) => ({
      companies: {
        edges: [{ cursor: 'c-3', node: { id: 'company-3', name: 'شرکت سوم' } }],
        pageInfo: { hasNextPage: true, endCursor: 'c-3' },
      },
    }));

    const page = await searchCustomersForPicker(
      { customerType: 'COMPANY', search: 'شرکت', afterCursor: 'c-2', pageSize: 1 },
      { execute },
    );

    const query = String(execute.mock.calls[0][0]);

    expect(query).toContain('after: "c-2"');
    expect(query).toContain('first: 1');
    expect(page.endCursor).toBe('c-3');
    expect(page.hasNextPage).toBe(true);
    expect(page.totalKnown).toBeNull();
  });

  it('asks for the selected record only when hydrating a preselection', async () => {
    const execute = vi.fn(async (_query: string) => ({
      companies: {
        edges: [{ node: { id: 'company-9', name: 'شرکت نهم' } }],
        pageInfo: { hasNextPage: false },
      },
    }));

    const page = await searchCustomersForPicker(
      { customerType: 'COMPANY', search: 'ignored text', recordId: 'company-9' },
      { execute },
    );

    const query = String(execute.mock.calls[0][0]);

    expect(query).toContain('filter: {id: {eq: "company-9"}}');
    expect(query).not.toContain('ilike');
    expect(page.rows[0]?.id).toBe('company-9');
  });

  it('accepts a customer that the workspace resolves', async () => {
    const result = await verifyCustomerRecord(
      { customerType: 'PERSON', recordId: 'person-1' },
      {
        execute: async () => ({
          people: {
            edges: [
              {
                node: {
                  id: 'person-1',
                  name: { firstName: 'سارا', lastName: 'احمدی' },
                },
              },
            ],
            pageInfo: { hasNextPage: false },
          },
        }),
      },
    );

    expect(result.ok).toBe(true);
  });

  it('refuses a customer id that resolves to nothing', async () => {
    const result = await verifyCustomerRecord(
      { customerType: 'COMPANY', recordId: 'company-missing' },
      {
        execute: async () => ({
          companies: { edges: [], pageInfo: { hasNextPage: false } },
        }),
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.refusal.code).toBe('CUSTOMER_NOT_FOUND');
  });

  it('refuses an empty customer id without a round-trip', async () => {
    const execute = vi.fn(async () => ({}));

    const result = await verifyCustomerRecord(
      { customerType: 'PERSON', recordId: '   ' },
      { execute },
    );

    expect(execute).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.refusal.code).toBe('CUSTOMER_PERSON_REQUIRED');
  });

  it('reports a read-permission refusal as a Persian message', async () => {
    const result = await verifyCustomerRecord(
      { customerType: 'COMPANY', recordId: 'company-1' },
      {
        execute: async () => {
          throw new RecordApiError('FORBIDDEN', 'forbidden');
        },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.refusal.code).toBe('PERMISSION_DENIED');
    expect(result.refusal.detail).toContain('دسترسی');
  });
});
