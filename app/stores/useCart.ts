import type { CartCustomerInfoDto, CartItemDto } from '~/types/cart'
import type { ProductDto } from '~/types/product'

type CartState = {
  items: CartItemDto[]
  customerInfo: CartCustomerInfoDto
}

export const useCartStore = defineStore('cart', {
  state: (): CartState => ({
    items: [],
    customerInfo: {
      customerTail: ''
    }
  }),
  actions: {
    addItem(product: ProductDto) {
      const existing = this.items.find((item) => item.id === product.id)
      if (existing) {
        existing.quantity += 1
        return
      }

      this.items.push({
        id: product.id,
        name: product.name,
        sku: product.sku,
        price: product.price,
        image: product.image ?? null,
        quantity: 1
      })
    },
    removeItem(productId: string) {
      this.items = this.items.filter((item) => item.id !== productId)
    },
    clearCart() {
      this.items = []
      this.customerInfo.customerTail = ''
    },
    updateQuantity(productId: string, quantity: number) {
      const item = this.items.find((entry) => entry.id === productId)
      if (!item) {
        return
      }
      if (quantity <= 0) {
        this.removeItem(productId)
        return
      }
      item.quantity = Math.floor(quantity)
    },
    setCustomerTail(value: string) {
      this.customerInfo.customerTail = value.replace(/\D/g, '').slice(-4)
    }
  },
  persist: {
    storage: piniaPluginPersistedstate.localStorage(),
    pick: ['items', 'customerInfo']
  }
})
