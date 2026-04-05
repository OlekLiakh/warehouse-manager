import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import ProductForm from './pages/ProductForm'
import Journal from './pages/Journal'
import InvoiceNew from './pages/InvoiceNew'
import InvoiceDetail from './pages/InvoiceDetail'

export default function App() {
  return (
    <BrowserRouter>
      <div className="max-w-4xl mx-auto px-4 py-4">
        <Routes>
          <Route path="/" element={<Products />} />
          <Route path="/product/new" element={<ProductForm />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/product/:id/edit" element={<ProductForm />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/invoice/new" element={<InvoiceNew />} />
          <Route path="/invoice/:id" element={<InvoiceDetail />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
