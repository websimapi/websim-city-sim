import * as THREE from 'three';

class Car {
    constructor(mesh, lane) {
        this.mesh = mesh;
        this.currentLane = lane;
        this.t = 0; // 0 to 1 along lane
        this.speed = 15; // Units per second
        this.state = 'DRIVING'; // DRIVING, WAITING
        
        // For curve interpolation
        this.curve = null;
        this.curveT = 0;
    }
}

class Pedestrian {
    constructor(mesh) {
        this.mesh = mesh;
        this.target = new THREE.Vector3();
        this.speed = 3;
    }
}

export class EntityManager {
    constructor(world) {
        this.world = world;
        this.cars = [];
        this.pedestrians = [];
        
        // New Larger Scales
        this.carGeo = new THREE.BoxGeometry(2, 1.5, 4.5);
        this.pedGeo = new THREE.BoxGeometry(0.6, 1.7, 0.6);
        
        this.stats = { cars: 0, pop: 0 };
    }

    init() {
        this.carMats = [
            new THREE.MeshLambertMaterial({ color: 0xe74c3c }),
            new THREE.MeshLambertMaterial({ color: 0x3498db }),
            new THREE.MeshLambertMaterial({ color: 0xf1c40f }),
            new THREE.MeshLambertMaterial({ color: 0xecf0f1 }),
            new THREE.MeshLambertMaterial({ color: 0x2c3e50 })
        ];
        this.pedMat = new THREE.MeshLambertMaterial({ color: 0xe67e22 });
    }

    spawnInitialPopulation() {
        // Clear old
        this.clear();

        // Spawn Cars on Lanes
        const lanes = this.world.city.lanes;
        if(lanes.length > 0) {
            for(let i=0; i<40; i++) {
                const lane = lanes[Math.floor(Math.random() * lanes.length)];
                this.spawnCar(lane);
            }
        }

        // Spawn Pedestrians
        for(let i=0; i<30; i++) {
            this.spawnPedestrian();
        }
    }
    
    clear() {
        [...this.cars, ...this.pedestrians].forEach(e => {
            if(e.mesh) this.world.scene.remove(e.mesh);
        });
        this.cars = [];
        this.pedestrians = [];
    }

    spawnCar(lane) {
        const mat = this.carMats[Math.floor(Math.random() * this.carMats.length)];
        const mesh = new THREE.Mesh(this.carGeo, mat);
        mesh.castShadow = true;
        
        const car = new Car(mesh, lane);
        car.t = Math.random(); // Random spot on lane
        
        // Set init pos
        const pos = new THREE.Vector3().lerpVectors(lane.start, lane.end, car.t);
        mesh.position.copy(pos);
        mesh.position.y = 1;
        mesh.lookAt(lane.end);
        
        this.world.scene.add(mesh);
        this.cars.push(car);
    }

    spawnPedestrian() {
        const mesh = new THREE.Mesh(this.pedGeo, this.pedMat);
        mesh.castShadow = true;
        
        // Random spot near center of blocks
        const range = 200;
        mesh.position.set(
            (Math.random()-0.5)*range, 
            1, 
            (Math.random()-0.5)*range
        );
        
        const ped = new Pedestrian(mesh);
        this.pickPedTarget(ped);
        
        this.world.scene.add(mesh);
        this.pedestrians.push(ped);
    }
    
    pickPedTarget(ped) {
        // Walk to random point
        ped.target.set(
            ped.mesh.position.x + (Math.random()-0.5)*40,
            1,
            ped.mesh.position.z + (Math.random()-0.5)*40
        );
    }

    update(dt) {
        this.updateCars(dt);
        this.updatePedestrians(dt);
        this.stats.cars = this.cars.length;
        this.stats.pop = this.pedestrians.length;
    }

    updateCars(dt) {
        const LANE_LENGTH = this.world.city.cellSize - this.world.city.roadWidth;
        
        this.cars.forEach(car => {
            if (car.state === 'DRIVING') {
                car.t += (car.speed * dt) / LANE_LENGTH; // Approx
                
                if (car.t >= 1) {
                    // Reached Intersection
                    car.t = 1;
                    const intersection = car.currentLane.to;
                    
                    // Check Lights
                    const isHorizontal = Math.abs(car.currentLane.dir.x) > 0.5;
                    const greenForMe = (intersection.lights.state === 'EW_GREEN' && isHorizontal) ||
                                       (intersection.lights.state === 'NS_GREEN' && !isHorizontal);
                    
                    if (greenForMe) {
                        // Pick new lane
                        const nextLanes = this.world.city.lanes.filter(l => l.from === intersection && l !== car.currentLane);
                        if (nextLanes.length > 0) {
                            const nextLane = nextLanes[Math.floor(Math.random() * nextLanes.length)];
                            
                            // Setup Curve
                            car.state = 'TURNING';
                            car.nextLane = nextLane;
                            car.curveT = 0;
                            
                            // Quadratic Bezier: Start, Control, End
                            const p0 = car.currentLane.end;
                            const p2 = nextLane.start;
                            // Control point is intersection center
                            const p1 = intersection.pos; 
                            
                            car.curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
                        } else {
                            // Dead end? U-turn or despawn. Just wrap t=0
                            car.t = 0;
                        }
                    } else {
                        car.state = 'WAITING';
                    }
                } else {
                    // Moving on lane
                    const pos = new THREE.Vector3().lerpVectors(car.currentLane.start, car.currentLane.end, car.t);
                    car.mesh.position.copy(pos);
                    car.mesh.position.y = 1;
                    car.mesh.lookAt(car.currentLane.end);
                }
            }
            else if (car.state === 'WAITING') {
                // Check light again
                const intersection = car.currentLane.to;
                const isHorizontal = Math.abs(car.currentLane.dir.x) > 0.5;
                const greenForMe = (intersection.lights.state === 'EW_GREEN' && isHorizontal) ||
                                   (intersection.lights.state === 'NS_GREEN' && !isHorizontal);
                
                if (greenForMe) {
                    car.state = 'DRIVING'; // Resume logic next frame
                }
            }
            else if (car.state === 'TURNING') {
                car.curveT += dt * 1.5; // Turn speed
                if (car.curveT >= 1) {
                    // Finished Turn
                    car.state = 'DRIVING';
                    car.currentLane = car.nextLane;
                    car.t = 0;
                } else {
                    const pos = car.curve.getPoint(car.curveT);
                    car.mesh.position.copy(pos);
                    car.mesh.position.y = 1;
                    // Look ahead
                    const look = car.curve.getPoint(Math.min(1, car.curveT + 0.1));
                    car.mesh.lookAt(look);
                }
            }
        });
    }

    updatePedestrians(dt) {
        this.pedestrians.forEach(ped => {
            const dist = ped.mesh.position.distanceTo(ped.target);
            if(dist < 1) {
                this.pickPedTarget(ped);
            } else {
                const dir = new THREE.Vector3().subVectors(ped.target, ped.mesh.position).normalize();
                ped.mesh.position.add(dir.multiplyScalar(ped.speed * dt));
                ped.mesh.lookAt(ped.target);
            }
        });
    }
    
    getRandomPedestrian() {
        if(this.pedestrians.length > 0) return this.pedestrians[Math.floor(Math.random()*this.pedestrians.length)];
        return null;
    }
}