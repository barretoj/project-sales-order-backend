import cds, { Request, Service } from '@sap/cds';
import { Customers, Product, Products, SalesOrderHeaders, SalesOrderIten, SalesOrderItens } from '@models/sales';
import { request } from 'axios';
import { FullRequestParams } from './protocols';
import { customerController } from './factories/controllers/customer';

export default (service : Service) => {
    service.before('READ', '*', (request: Request) => {
     if (!request.user.is('read_only_user')) {
        return request.reject(403, 'Unauthorized access to read');
        }  
    });
    service.before(['WRITE', 'DELETE'], '*', (request: Request) => {
        if (!request.user.is('admin')) {
            return request.reject(403, 'Unauthorized access to write or delete');
        }
    });
    service.after('READ', 'Customers', (customersList: Customers, request) => {
        (request as unknown as FullRequestParams<Customers>).results = customerController.afterRead(customersList);
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
        let totalAmount = 0;
        items.forEach(item => {
            totalAmount += (item.quantity as number) * (item.price as number);
        });
        console.log('Total Amount before discount:', totalAmount);
        if (totalAmount > 30000) {
            const discount = totalAmount * (10/100);
            totalAmount -= discount;
        }
        console.log('Total Amount after discount:', totalAmount);
        request.data.totalAmount = totalAmount;
    });
    service.after('CREATE', 'SalesOrderHeaders', async (results: SalesOrderHeaders, request: Request) => {
        const headerAsArray = Array.isArray(results) ? results : [results] as SalesOrderHeaders;
        for (const header of headerAsArray) {
            const items = header.items as SalesOrderItens;
            const productsData = items.map(item => ({
                id: item.product_id as string,
                quantity: item.quantity as number
            }));
            const productsIds: string[] = productsData.map((productData) => productData.id);
            const productsQuery = SELECT.from('sales.Products').where({ id: productsIds });
            const products: Products = await cds.run(productsQuery);
            for (const productData of productsData) {
                const foundProduct = products.find(product => product.id === productData.id) as Product ;
                foundProduct.stock = (foundProduct.stock as number) - productData.quantity;
                await cds.update('sales.Products').where({ id: foundProduct.id }).with({ stock: foundProduct.stock });
            }
            const headerAsString = JSON.stringify(header);
            const userAsString = JSON.stringify(request.user);
            const log = [{
                header_id: header.id,
                userData: userAsString,
                orderData: headerAsString
            }]
            await cds.create('sales.SalesOrderLogs').entries(log);
            console.log(log);
        }
    });
};