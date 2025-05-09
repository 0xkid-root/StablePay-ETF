import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Define the database schema
interface StablePayDB extends DBSchema {
  employers: {
    key: string; // wallet address
    value: {
      address: string;
      name?: string;
      registrationDate: number;
      lastLogin?: number;
    };
    indexes: { 'by-name': string };
  };
  employees: {
    key: string; // wallet address
    value: {
      address: string;
      name: string;
      employerAddress: string;
      amount: string;
      schedule: string;
      registrationDate: number;
      lastPaid?: number;
      status: 'Active' | 'Inactive';
    };
    indexes: { 'by-employer': string };
  };
  transactions: {
    key: string; // transaction hash
    value: {
      hash: string;
      date: number;
      from: string;
      to: string;
      amount: string;
      description: string;
      status: 'Pending' | 'Completed' | 'Failed';
    };
    indexes: { 'by-from': string; 'by-to': string; 'by-date': number };
  };
}

// Database version
const DB_VERSION = 1;
const DB_NAME = 'stablepay-etf-db';

// Singleton pattern for database connection
let dbPromise: Promise<IDBPDatabase<StablePayDB>> | null = null;

export const getDB = (): Promise<IDBPDatabase<StablePayDB>> => {
  if (!dbPromise) {
    dbPromise = openDB<StablePayDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create stores if they don't exist
        if (!db.objectStoreNames.contains('employers')) {
          const employerStore = db.createObjectStore('employers', { keyPath: 'address' });
          employerStore.createIndex('by-name', 'name');
        }

        if (!db.objectStoreNames.contains('employees')) {
          const employeeStore = db.createObjectStore('employees', { keyPath: 'address' });
          employeeStore.createIndex('by-employer', 'employerAddress');
        }

        if (!db.objectStoreNames.contains('transactions')) {
          const txStore = db.createObjectStore('transactions', { keyPath: 'hash' });
          txStore.createIndex('by-from', 'from');
          txStore.createIndex('by-to', 'to');
          txStore.createIndex('by-date', 'date');
        }
      },
    });
  }
  return dbPromise;
};

// Employer operations
export const employerDB = {
  async add(employerData: Omit<StablePayDB['employers']['value'], 'registrationDate'>) {
    const db = await getDB();
    return db.add('employers', {
      ...employerData,
      registrationDate: Date.now(),
    });
  },

  async update(employerData: Partial<StablePayDB['employers']['value']> & { address: string }) {
    const db = await getDB();
    const existing = await db.get('employers', employerData.address);
    if (!existing) {
      throw new Error('Employer not found');
    }
    return db.put('employers', { ...existing, ...employerData });
  },

  async get(address: string) {
    const db = await getDB();
    return db.get('employers', address);
  },

  async getAll() {
    const db = await getDB();
    return db.getAll('employers');
  },

  async delete(address: string) {
    const db = await getDB();
    return db.delete('employers', address);
  },

  async updateLastLogin(address: string) {
    const db = await getDB();
    const existing = await db.get('employers', address);
    if (!existing) {
      throw new Error('Employer not found');
    }
    return db.put('employers', { ...existing, lastLogin: Date.now() });
  }
};

// Employee operations
export const employeeDB = {
  async add(employeeData: Omit<StablePayDB['employees']['value'], 'registrationDate' | 'status'>) {
    const db = await getDB();
    return db.add('employees', {
      ...employeeData,
      registrationDate: Date.now(),
      status: 'Active',
    });
  },

  async update(employeeData: Partial<StablePayDB['employees']['value']> & { address: string }) {
    const db = await getDB();
    const existing = await db.get('employees', employeeData.address);
    if (!existing) {
      throw new Error('Employee not found');
    }
    return db.put('employees', { ...existing, ...employeeData });
  },

  async get(address: string) {
    const db = await getDB();
    return db.get('employees', address);
  },

  async getAll() {
    const db = await getDB();
    return db.getAll('employees');
  },

  async getByEmployer(employerAddress: string) {
    const db = await getDB();
    const index = db.transaction('employees').store.index('by-employer');
    return index.getAll(employerAddress);
  },

  async delete(address: string) {
    const db = await getDB();
    return db.delete('employees', address);
  },

  async updateLastPaid(address: string) {
    const db = await getDB();
    const existing = await db.get('employees', address);
    if (!existing) {
      throw new Error('Employee not found');
    }
    return db.put('employees', { ...existing, lastPaid: Date.now() });
  },

  async updateStatus(address: string, status: 'Active' | 'Inactive') {
    const db = await getDB();
    const existing = await db.get('employees', address);
    if (!existing) {
      throw new Error('Employee not found');
    }
    return db.put('employees', { ...existing, status });
  }
};

// Transaction operations
export const transactionDB = {
  async add(txData: Omit<StablePayDB['transactions']['value'], 'date'>) {
    const db = await getDB();
    return db.add('transactions', {
      ...txData,
      date: Date.now(),
    });
  },

  async update(txData: Partial<StablePayDB['transactions']['value']> & { hash: string }) {
    const db = await getDB();
    const existing = await db.get('transactions', txData.hash);
    if (!existing) {
      throw new Error('Transaction not found');
    }
    return db.put('transactions', { ...existing, ...txData });
  },

  async get(hash: string) {
    const db = await getDB();
    return db.get('transactions', hash);
  },

  async getAll() {
    const db = await getDB();
    return db.getAll('transactions');
  },

  async getByFrom(address: string) {
    const db = await getDB();
    const index = db.transaction('transactions').store.index('by-from');
    return index.getAll(address);
  },

  async getByTo(address: string) {
    const db = await getDB();
    const index = db.transaction('transactions').store.index('by-to');
    return index.getAll(address);
  },

  async getByDateRange(startDate: number, endDate: number) {
    const db = await getDB();
    const index = db.transaction('transactions').store.index('by-date');
    return index.getAll(IDBKeyRange.bound(startDate, endDate));
  }
};
