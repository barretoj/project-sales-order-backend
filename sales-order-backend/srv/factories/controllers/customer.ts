import { CustomerControllerImpl } from "../../controllers/customer/implementations";
import { CustomerController } from "../../controllers/customer/protocols";
import { customerService } from "../services/customer";

const makeCustomerController = (): CustomerController => {
    return new CustomerControllerImpl(customerService);
}

export const customerController = makeCustomerController();