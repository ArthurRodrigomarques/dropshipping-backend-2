import { Router } from "express";

import { createAccess, getAllAccesses } from "./controller/AccessController";
import {
  createProduct,
  deleteProduct,
  getAllProducts,
  getUniqueProduct,
  updateProduct,
} from "./controller/ProductController";
import {
  createSale,
  getAllSales,
  getAllSalesByBuyer,
  getAllSalesBySeller,
} from "./controller/SaleController";
import { signIn } from "./controller/SessionController";
import {
  createStore,
  deleteStore,
  getAllStore,
  getUniqueStore,
  updateStore,
} from "./controller/StoreController";
import {
  createUser,
  deleteUser,
  getAllUser,
  getUniqueUser,
  getUniqueUserId,
} from "./controller/UserController";
import { authMiddleware } from "./middlewares/AuthMiddleware";
import multerConfig from "../config/multer";
import { handleWebhook } from "./middlewares/WebHooks";
import bodyParser from "body-parser";
import { createAddress, deleteAddress, getAddressById, updateAddress } from "./controller/AddressController";
import { createCheckoutSession, getOrderDetails, getOrdersForAdmin } from "./controller/OrderController";

export const router = Router();

/**
 * Rotas do usuário
 */
router.post("/register", createUser);
router.delete("/delete-users", authMiddleware(["adm"]), deleteUser);
router.get("/get-all-users", authMiddleware(["adm"]), getAllUser);
router.get(
  "/get-unique-user",
  authMiddleware(["adm", "Vendedor", "Comprador"]),
  getUniqueUser
);
router.get(
  "/get-unique-user-id/:id",
  // authMiddleware(["adm", "Vendedor", "Comprador"]),
  getUniqueUserId
);


// rotas de endereço
router.post("/address",  
  authMiddleware(["adm", "Vendedor", "Comprador"]),
  createAddress
);
router.get("/addresses/:id",
  authMiddleware(["adm", "Vendedor", "Comprador"]),
   getAddressById
);
router.put("/addresses", 
  authMiddleware(["adm", "Vendedor", "Comprador"]),
  updateAddress
);
router.delete("/addresses/:id", 
  authMiddleware(["adm", "Vendedor", "Comprador"]),
  deleteAddress
);


/**
 * Rotas de acessos
 */
router.post("/access", authMiddleware(["adm"]), createAccess);
router.get("/accesses", authMiddleware(["adm", "Vendedor"]), getAllAccesses);

/**
 * Rotas da loja
 */
router.post("/store", authMiddleware(["adm", "Vendedor"]), createStore);
router.get(
  "/stores",
  authMiddleware(["adm", "Vendedor", "Comprador"]),
  getAllStore
);
router.get(
  "/get-unique-store/:storeId",
  authMiddleware(["adm", "Vendedor", "Comprador"]),
  getUniqueStore
);
router.put(
  "/update-store/:storeId",
  authMiddleware(["adm", "Vendedor"]),
  updateStore
);
router.delete(
  "/delete-store/:storeId",
  authMiddleware(["adm", "Vendedor"]),
  deleteStore
)

/**
 * Rotas do produto
 */
router.post(
  "/product/:storeId",
  multerConfig.array('images', 5),
  authMiddleware(["adm", "Vendedor"]),
  createProduct
);
router.get(
  "/products",
  getAllProducts
);
router.put(
  "/update-product/:productId",
  authMiddleware(["adm", "Vendedor"]),
  updateProduct
);
router.get(
  "/get-unique-product/:productId",
  getUniqueProduct
);
router.delete(
  "/delete-product/:productId",
  authMiddleware(["adm", "Vendedor"]),
  deleteProduct
);

/**
 * Rotas de autenticação
 */
router.post("/sign-in", signIn);

/**
 * Rotas da venda
 */
router.post(
  "/create-checkout-session",
 authMiddleware(["adm", "Vendedor", "Comprador"]),
  createCheckoutSession)

router.post('/webhook', bodyParser.raw({type: 'application/json'}), handleWebhook)

router.get("/admin/orders", getOrdersForAdmin)

router.get("/order-details", getOrderDetails);


router.post(
  "/create-sale",
  authMiddleware(["adm", "Vendedor", "Comprador"]),
  createSale
);
router.get("/get-all-sales", authMiddleware(["adm", "Vendedor"]), getAllSales);
router.get(
  "/get-all-sales-by-buyer",
  authMiddleware(["adm", "Vendedor","Comprador"]),
  getAllSalesByBuyer
);
router.get(
  "/get-all-sales-by-seller",
  authMiddleware(["adm", "Vendedor"]),
  getAllSalesBySeller
);

// Controle de vendas

