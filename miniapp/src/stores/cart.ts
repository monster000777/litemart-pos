import { defineStore } from 'pinia'
import type { CartItem, Customer, Product } from '../types'

type CartState = {
  items: CartItem[]
  member: Customer | null
  pointsToUse: number
}

const findItemIndex = (items: CartItem[], productId: string) =>
  items.findIndex((item) => item.productId === productId)

export const useCartStore = defineStore('cart', {
  state: (): CartState => ({
    items: [],
    member: null,
    pointsToUse: 0
  }),
  getters: {
    totalCount: (state) => state.items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: (state) => state.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    totalAmount(state) {
      const subtotal = state.items.reduce((sum, item) => {
        const unitPrice = state.member && item.memberPrice != null ? item.memberPrice : item.price
        return sum + unitPrice * item.quantity
      }, 0)
      const discount = Math.max(
        0,
        Math.min(Math.floor(state.pointsToUse / 100), Math.floor(subtotal * 0.5))
      )
      return Math.max(0, Number((subtotal - discount).toFixed(2)))
    }
  },
  actions: {
    addProduct(product: Product) {
      const index = findItemIndex(this.items, product.id)
      if (index === -1) {
        this.items.push({
          productId: product.id,
          name: product.name,
          image: product.image,
          price: product.price,
          memberPrice: product.memberPrice,
          quantity: 1,
          stock: product.stock
        })
        return
      }

      const current = this.items[index]
      if (current.quantity < current.stock) {
        current.quantity += 1
      }
    },
    updateQuantity(productId: string, quantity: number) {
      const index = findItemIndex(this.items, productId)
      if (index === -1) {
        return
      }

      if (quantity <= 0) {
        this.items.splice(index, 1)
        return
      }

      this.items[index].quantity = Math.min(quantity, this.items[index].stock)
    },
    clearCart() {
      this.items = []
      this.member = null
      this.pointsToUse = 0
    },
    setMember(member: Customer | null) {
      this.member = member
      if (!member) {
        this.pointsToUse = 0
      }
    },
    setPointsToUse(points: number) {
      const available = this.member?.points ?? 0
      this.pointsToUse = Math.max(0, Math.min(points, available))
    }
  }
})
