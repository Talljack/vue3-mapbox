import { useMapEvent } from '../../lib/useEvents'
import { useSelfEvents } from './useSelfEvents'
import { h, defineComponent, PropType, ref, inject, watch, provide, onMounted, onUnmounted, nextTick } from 'vue'
import type Mapboxgl from 'mapbox-gl'
import { mapKey, markerKey } from '../map/types'
import mapboxgl from 'mapbox-gl'

const markerEvents = {
  drag: 'drag',
  dragstart: 'dragstart',
  dragend: 'dragend'
}

const markerDOMEvents = {
  click: 'click',
  mouseenter: 'mouseenter',
  mouseleave: 'mouseleave'
}

export default defineComponent({
  name: 'MapMarker',

  props: {
    offset: {
      type: [Object, Array] as PropType<Mapboxgl.MarkerOptions['offset']>,
      default: () => [0, 0]
    },
    coordinates: {
      type: Array as PropType<number[]>,
      required: true
    },
    color: {
      type: String
    },
    anchor: {
      type: String,
      default: 'center'
    },
    draggable: {
      type: Boolean,
      default: false
    },
    rotation: {
      type: Number,
      default: 0
    },
    scale: {
      type: Number,
      default: 0
    }
  },
  emits: ['update:coordinates', 'added', 'click', 'mouseenter', 'mouseleave', 'drag', 'dragstart', 'dragend'],
  setup(props, { emit, attrs, slots }) {
    const map = inject(mapKey)!
    const { bindSelfEvents } = useSelfEvents({ emit, attrs, map: map?.value })
    const { emitEvent } = useMapEvent({ emit, attrs, map: map?.value })
    const initial = ref(true)
    const marker = ref<Mapboxgl.Marker | null>(null)
    const markerRef = ref<HTMLElement | null>(null)

    // watch
    watch(
      () => props.coordinates,
      value => {
        if (initial.value) return
        marker.value?.setLngLat(value as Mapboxgl.LngLatLike)
      }
    )
    watch(
      () => props.draggable,
      next => {
        if (initial.value) return
        marker.value?.setDraggable(next)
      }
    )
    watch(
      () => props.rotation,
      next => {
        if (initial.value) return
        marker.value?.setRotation(next)
      }
    )
    watch(
      () => props.offset,
      next => {
        if (initial.value || !next) return
        marker.value?.setOffset(next)
      }
    )
    provide(markerKey, marker)

    // method
    function addMarker() {
      marker.value
        // 放宽类型
        ?.setLngLat(props.coordinates as Mapboxgl.LngLatLike)
        .setRotation(props.rotation)
        .addTo(map.value)
      bindMarkerDomEvents()
      emitEvent('added', { marker: marker.value })
    }
    function bindMarkerDomEvents() {
      Object.values(markerDOMEvents).forEach(key => {
        // @ts-expect-error
        marker.value?._element.addEventListener(key, event => {
          emitSelfEvent(event)
        })
      })
    }

    function emitSelfEvent(event) {
      emit(event.type, event)
    }

    function remove() {
      marker.value?.remove()
      emitEvent('removed')
    }

    onMounted(() => {
      const markerOptions = {
        ...props
      }
      nextTick(() => {
        if (slots.marker) {
          ;(markerOptions as Mapboxgl.MarkerOptions).element = markerRef.value?.children?.[0] as HTMLElement
        }
        // @ts-expect-error
        marker.value = new mapboxgl.Marker(markerOptions)
        if (attrs['onUpdate:coordinates']) {
          marker.value?.on('dragend', event => {
            let newCoordinates
            if (props.coordinates instanceof Array) {
              // @ts-expect-error
              newCoordinates = [event.target._lngLat.lng, event.target._lngLat.lat]
            } else {
              // @ts-expect-error
              newCoordinates = event.target._lngLat
            }
            emit('update:coordinates', newCoordinates)
          })
        }
        const eventNames = Object.keys(markerEvents)
        bindSelfEvents(eventNames, marker.value)
        initial.value = false
        addMarker()
      })
    })
    onUnmounted(() => {
      if (map.value && marker.value) {
        marker.value?.remove()
      }
    })
    return {
      remove,
      marker,
      markerRef
    }
  },
  render() {
    return h('div', { style: { display: 'none' }, ref: 'markerRef' }, [
      this.$slots.marker?.(),
      this.marker ? this.$slots.default?.() : null
    ])
  }
})
