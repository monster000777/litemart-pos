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
      customerTail: '',
      memberId: '',
      memberName: null,
      memberPhone: '',
      memberPoints: 0,
      memberLevel: '',
      pointsToUse: 0
    }
  }),
  actions: {
    addItem(product: ProductDto) {
      const effectivePrice =
        this.customerInfo.memberId && product.memberPrice != null
          ? product.memberPrice
          : product.price
      const existing = this.items.find((item) => item.id === product.id)
      if (existing) {
        existing.quantity += 1
        existing.price = effectivePrice
        existing.originalPrice = product.price
        return
      }

      this.items.push({
        id: product.id,
        name: product.name,
        sku: product.sku,
        price: effectivePrice,
        originalPrice: product.price,
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
      this.customerInfo.memberId = ''
      this.customerInfo.memberName = null
      this.customerInfo.memberPhone = ''
      this.customerInfo.memberPoints = 0
      this.customerInfo.memberLevel = ''
      this.customerInfo.pointsToUse = 0
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
    },
    setMember(
      member?: {
        id: string
        phone: string
        name: string | null
        points: number
        level: string
      } | null
    ) {
      this.customerInfo.memberId = member?.id ?? ''
      this.customerInfo.memberName = member?.name ?? null
      this.customerInfo.memberPhone = member?.phone ?? ''
      this.customerInfo.memberPoints = member?.points ?? 0
      this.customerInfo.memberLevel = member?.level ?? ''
      this.customerInfo.customerTail = member?.phone?.slice(-4) ?? this.customerInfo.customerTail
      this.customerInfo.pointsToUse = 0
    },
    setPointsToUse(points: number) {
      this.customerInfo.pointsToUse = Math.max(0, Math.floor(points))
    },
    refreshCartPrices(products: ProductDto[]) {
      const productMap = new Map(products.map((product) => [product.id, product]))
      this.items = this.items.map((item) => {
        const product = productMap.get(item.id)
        if (!product) {
          return item
        }
        const effectivePrice =
          this.customerInfo.memberId && product.memberPrice != null
            ? product.memberPrice
            : product.price

        return {
          ...item,
          price: effectivePrice,
          originalPrice: product.price
        }
      })
    }
  },
  persist: {
    storage: piniaPluginPersistedstate.localStorage(),
    pick: ['items', 'customerInfo']
  }
})
