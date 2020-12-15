/* global THREE */

global.THREE = require('three')
require('three/examples/js/controls/OrbitControls')

const { Viewer } = require('./viewer')
const { Vec3 } = require('vec3')

const io = require('socket.io-client')
const socket = io()

let firstPositionUpdate = true

const renderer = new THREE.WebGLRenderer()
renderer.setPixelRatio(window.devicePixelRatio || 1)
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

const viewer = new Viewer(renderer)

let controls = new THREE.OrbitControls(viewer.camera, renderer.domElement)

function animate () {
  window.requestAnimationFrame(animate)
  if (controls) controls.update()
  renderer.render(viewer.scene, viewer.camera)
}
animate()

window.addEventListener('pointerdown', (evt) => {
  const raycaster = new THREE.Raycaster()
  const mouse = new THREE.Vector2()
  mouse.x = (evt.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(evt.clientY / window.innerHeight) * 2 + 1
  raycaster.setFromCamera(mouse, viewer.camera)
  const ray = raycaster.ray
  socket.emit('mouseClick', { origin: ray.origin, direction: ray.direction, button: evt.button })
})

socket.on('version', (version) => {
  viewer.setVersion(version)
  firstPositionUpdate = true

  let botMesh
  socket.on('position', ({ pos, addMesh, yaw, pitch }) => {
    if (yaw !== undefined && pitch !== undefined) {
      if (controls) {
        controls.dispose()
        controls = null
      }
      viewer.setFirstPersonCamera(pos, yaw, pitch)
      return
    }
    if (pos.y > 0 && firstPositionUpdate) {
      controls.target.set(pos.x, pos.y, pos.z)
      viewer.camera.position.set(pos.x, pos.y + 20, pos.z + 20)
      controls.update()
      firstPositionUpdate = false
    }
    if (addMesh) {
      if (!botMesh) {
        const geometry = new THREE.BoxGeometry(0.6, 1.8, 0.6)
        geometry.translate(0, 0.9, 0)
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 })
        botMesh = new THREE.Mesh(geometry, material)
        viewer.scene.add(botMesh)
      }
      botMesh.position.set(pos.x, pos.y, pos.z)
    }
  })

  socket.on('entity', (e) => {
    viewer.updateEntity(e)
  })

  socket.on('primitive', (p) => {
    viewer.updatePrimitive(p)
  })

  socket.on('chunk', (data) => {
    const [x, z] = data.coords.split(',')
    viewer.addColumn(parseInt(x, 10), parseInt(z, 10), data.chunk)
  })

  socket.on('unloadChunk', ({ x, z }) => {
    viewer.removeColumn(x, z)
  })

  socket.on('blockUpdate', ({ pos, stateId }) => {
    viewer.setBlockStateId(new Vec3(pos.x, pos.y, pos.z), stateId)
  })
})
