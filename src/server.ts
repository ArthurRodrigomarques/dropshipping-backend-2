import express from "express";
import cors from "cors"
import { router } from "./router";

const app = express();

app.use(cors())
app.use(express.json())

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*")
    res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE")
    res.header("Access-Control-Allow-Headers", "X-PINGOTHER Content-Type, Authorization")
    app.use(cors())
    next()
})

app.use(router);

const port = process.env.PORT

app.listen(port, () => {
    console.log(`O servidor está rodando na porta http://localhost:${port}`)
})