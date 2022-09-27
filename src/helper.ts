import { AccountsApi, Environment } from '@emilgroup/account-sdk-node';
import { InvoicesApi } from '@emilgroup/billing-sdk-node';
import {
  PoliciesApi,
  PoliciesApiListPoliciesRequest,
  ProductsApi,
} from '@emilgroup/insurance-sdk-node';
import { PaymentsApi, PaymentMethodsApi } from '@emilgroup/payment-sdk-node';
import dayjs from 'dayjs';
import { DATE_FORMAT } from '../config/constant';

const accountsApi = new AccountsApi();
const policiesApi = new PoliciesApi();
const paymentApi = new PaymentsApi();
const paymentMethodApi = new PaymentMethodsApi();
const invoiceApi = new InvoicesApi();
const productApi = new ProductsApi();
const environment = process.env.ENV === 'production' ? Environment.Production : Environment.Test;

interface AdditionalData {
  timeline: any;
  targetAttr: string;
  productVersionId: number;
  fields: string[];
  decimalPlace: number;
}

async function getAccount(code: string) {
  console.log(`Attempting to get account with code ${code}`);
  const {
    data: { account },
  } = await accountsApi.getAccount({ code });

  return account;
}

async function getPaymentMethods(accountCode: string) {
  console.log(`Attempting to get payment method for account ${accountCode}`);

  const params = {
    filter: `accountCode=${accountCode}`,
  };

  const {
    data: { items },
  } = await paymentMethodApi.listPaymentMethods(params);

  return items;
}

async function getPayments(accountCode: string) {
  console.log(`Attempting to get payments for account ${accountCode}`);

  const params = {
    filter: `accountCode=${accountCode}`,
  };

  const {
    data: { items },
  } = await paymentApi.listPayments(params);

  return items;
}

async function getInvoices(policyCode: string) {
  console.log(`Attempting to get policy: ${policyCode}`);

  const params = {
    filter: `policyCode=${policyCode}`,
  };

  const {
    data: { items },
  } = await invoiceApi.listInvoices(params);

  return items;
}

async function gePolicyBillingDates(policyCode: string) {
  console.log(`Attempting to get policy billing dates: ${policyCode}`);

  const params = {
    filter: `policyCode=${policyCode}`,
  };

  const {
    data: { items },
  } = await invoiceApi.listPoliciesBillingDates(params);

  return items;
}

async function getPolicies(params?: PoliciesApiListPoliciesRequest) {
  console.log(`Attempting to list policies`);

  const {
    data: { items, nextPageToken },
  } = await policiesApi.listPolicies(params);

  return { items, nextPageToken };
}

async function getPoliciesInDay(date: Date, pageToken?: string) {
  const createdAt = dayjs(date).format(DATE_FORMAT);

  const params: PoliciesApiListPoliciesRequest = {
    filter: `createdAt=${createdAt}`,
    expand: 'premiumFormulas',
    pageToken,
  };

  return getPolicies(params);
}

async function getData(
  date: Date,
  data: any[] = [],
  pageToken?: string
): Promise<any> {
  await accountsApi.initialize(environment);
  await policiesApi.initialize(environment);
  await paymentApi.initialize(environment);
  await paymentMethodApi.initialize(environment);
  await invoiceApi.initialize(environment);
  await productApi.initialize(environment);
  const { items, nextPageToken } = await getPoliciesInDay(date, pageToken);

  if (!items) {
    console.log(`No policies created for today ${dayjs(date).format(DATE_FORMAT)}`);

    return Promise.resolve();
  }

  for (const policy of items) {
    const { accountCode, code: policyCode } = policy as any;
    const account = await getAccount(accountCode);
    const timeline = getFormattedTimeline(policy);
    
    await AddAdditionalPolicyData(
     { timeline,
      targetAttr: 'plz',
      productVersionId: policy.productVersionId,
      fields:['zoneErdbeben','zoneLeitungswasser','zoneSturmHagel'],
     decimalPlace:0
    }
    )

    const payments = await getPayments(accountCode);
    const paymentMethods = await getPaymentMethods(accountCode);
    const invoices = await getInvoices(policyCode);
    const billingDates = await gePolicyBillingDates(policyCode);

    data.push({
      policy: buildPolicyData(policy),
      account: buildAccountData(account),
      payments,
      paymentMethods,
      invoices,
      billingDates
    });
  }

  if (nextPageToken) {
    return getData(date, data, nextPageToken);
  }

  return Promise.resolve();
}

function buildAccountData(account: any): any {
  if (!account) { return }
  const customFields = account.customFields;

  delete account.customFields;

  return {
    ...account,
    ...customFields,
  }
}

function buildPolicyData(policy: any): any {
  const currentPolicyVersion ={...policy.versions.find((pv: any) => pv.isCurrent)};
  delete currentPolicyVersion.metadata;
  const policyObjects: any = [];

  const { timeline } = currentPolicyVersion;

  timeline.forEach((t:any) => {
    t.policyObjects.forEach((po: any) => {
      policyObjects.push({
        from: t.from,
        to: t.to, 
        data: po.data
      })
    })
  });
  const p = {
  id: policy.id,
  code: policy.code,
  policyNumber: policy.policyNumber,
  accountCode: policy.accountCode,
  createdAt: policy.createdAt,
  updatedAt: policy.updatedAt,
  policyStartDate: policy.policyStartDate,
}

  const policyData = {
    ...p,
    product: policy.product,
    policyObjects
  }

  return policyData;
}

// JUST FOR ENZO
async function AddAdditionalPolicyData(
    payload: AdditionalData,
  ): Promise<any> {
    const {
      timeline, targetAttr, fields, productVersionId, decimalPlace,
    } = payload;
    const baseInsuredObject = timeline.policyObjects
      .find((p: any) => p.insuredObjectName !== 'default' && p.data[targetAttr]);

    if (baseInsuredObject?.data) {
      const productFactorName = baseInsuredObject.data[targetAttr] as string;

      if (productFactorName) {
        const promises = fields.map((field) => constructMissingData(
          field, productFactorName, productVersionId, decimalPlace,
        ));
        const productFactorValues = await Promise.all(promises);
        let newFields = {};

        productFactorValues.forEach((pfv) => {
          newFields = { ...newFields, ...pfv };
        });

        baseInsuredObject.data = { ...baseInsuredObject.data, ...newFields };
      }
    }

    return timeline;
  }

  async function constructMissingData(
    field: string,
    productFactorName: string,
    productVersionId: number,
    decimalPlace: number,
  ): Promise<Record<string, string>> {
    const payload: Record<string, string> = {};
    const params = {
      label: field,
      name: productFactorName,
      productVersionId,
      key: '',
    };

    const productFactorValue = await productApi.getProductFactorValue(params);
    payload[field] = Number(productFactorValue.data.value.value).toFixed(decimalPlace);

    return payload;
  }

  function getFormattedTimeline(policy: any): any {
    const currentVersion = policy.versions.find((p: any) => p.isCurrent);

    if (!currentVersion) {
      throw new Error(`Current version is not found for policy ${policy.code}`);
    }

    const [timeline] = currentVersion.timeline;

    const newTimeLine = { ...timeline };
    const insuredObject = newTimeLine.policyObjects.map((obj: any) => {
      obj.data = JSON.parse(obj.summary);
      delete obj.summary;

      return obj;
    });

    const defaultInsuredObject = newTimeLine.policyObjects.find((p: any) => p.insuredObjectName === 'default');

    if (defaultInsuredObject?.data) {
      const {
        policyStartDate,
        policyDurationUnit,
        policyDurationValue,
      } = defaultInsuredObject.data as any;

      newTimeLine.to = dayjs(policyStartDate).add(policyDurationValue, policyDurationUnit).toDate();
      newTimeLine.defaultPolicyObject = defaultInsuredObject;
    }

    newTimeLine.policyObjects = insuredObject.filter((p: any) => p.insuredObjectName !== 'default');

    return newTimeLine;
  }



export async function execute(date: Date) {
  const reportData: any[] = [];
  await getData(date, reportData);

  return reportData;
}
