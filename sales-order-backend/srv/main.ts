import cds, { Request, Service } from '@sap/cds';
import { Customers, Products, SalesOrderIten, SalesOrderItens } from '@models/sales';

export default (service : Service) => {
    service.after('READ', 'Customers', (results: Customers) => {
        results.forEach(customer => {
            if (customer.email && !customer.email?.includes('@')) {
                customer.email = `${customer.email}@gmail.com`;
            }
        });
    });
    service.before('CREATE', 'SalesOrderHeaders', async (request: Request) => {
        const params = request.data;
        const items: SalesOrderItens = params.items;
        if (!params.customer_id) {
            return request.reject(400, 'Customer ID is required');
        }
        if (!params.items || params.items.length === 0) {
            return request.reject(400, 'At least one item is required');
        }        
        const customerQuery = SELECT.one.from('sales.Customers').where({ id: params.customer_id });
        const customer = await cds.run(customerQuery);
        if (!customer) {
            return request.reject(404, 'Customer not found');
        }
        const productIds: string[] = params.items.map((item: SalesOrderIten) => item.product_id);
        const productsQuery = SELECT.from('sales.Products').where({ id: productIds });
        const products: Products = await cds.run(productsQuery);
        for (const item of items) {
            const dbProdutc = products.find(product => product.id === item.product_id);
            if (!dbProdutc) {
                return request.reject(404, `Product with ID ${item.product_id} not found`);
            }
            if (dbProdutc.stock === 0) {
                return request.reject(400, `Product with ID ${item.product_id} is out of stock`);
            }
        }
    });
};