import { CustomerService } from "../../service/customer/protocols";
import { CustomerServiceImpl } from "../../service/customer/implementations";

const makeCustomerService = (): CustomerService => {
    return new CustomerServiceImpl();
}

export const customerService = makeCustomerService();