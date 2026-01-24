import * as THREE from 'three';

class Entity {
    constructor(mesh) {
        this.mesh = mesh;
        this.active = true;
        this.target = new THREE.Vector3();
    }
}

class Car extends Entity {
    constructor(mesh) {
        super(mesh);
        this.speed = 0;
        this.state = 'PARKED'; // PARKED, DRIVING, FINDING_SPOT
        this.dir = new THREE.Vector3(0, 0, 1);
        this.passenger = null; // Associated pedestrian
    }
}

class Pedestrian extends Entity {
    constructor(mesh) {
        super(mesh);
        this.speed = 2;
        this.state = 'WANDERING'; // WANDERING, GOING_TO_CAR, DRIVING (hidden)
        this.targetCar = null;
    }
}

export class EntityManager {
    constructor(world) {
        this.world = world;
        this.cars = [];
        this.pedestrians = [];
        this.carGeo = new THREE.BoxGeometry(1.5, 1, 3);
        this.pedGeo = new THREE.BoxGeometry(0.5, 1, 0.5);
        this.stats = { cars: 0, pop: 0 };
    }

    init() {
        // Prepare materials
        this.carMats = [
            new THREE.MeshLambertMaterial({ color: 0xff0000 }),
            new THREE.MeshLambertMaterial({ color: 0x0000ff }),
            new THREE.MeshLambertMaterial({ color: 0xffffff }),
            new THREE.MeshLambertMaterial({ color: 0x222222 })
        ];
        this.pedMat = new THREE.MeshLambertMaterial({ color: 0xffddaa });
    }

    spawnInitialPopulation() {
        // Spawn parked cars
        for (let i = 0; i < 20; i++) {
            this.spawnCar(true);
        }
        // Spawn pedestrians
        for (let i = 0; i < 15; i++) {
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

    spawnCar(parked = false) {
        const mat = this.carMats[Math.floor(Math.random() * this.carMats.length)];
        const mesh = new THREE.Mesh(this.carGeo, mat);
        mesh.castShadow = true;
        
        const pos = this.world.city.getRandomRoadPoint();
        mesh.position.copy(pos);
        mesh.position.y = 0.5;

        const car = new Car(mesh);
        if (parked) {
            car.state = 'PARKED';
            // Move to side of road
            // snap to nearest axis
            if (Math.random() > 0.5) {
                mesh.rotation.y = 0;
                mesh.position.x += 1.5; // Offset to curb
            } else {
                mesh.rotation.y = Math.PI/2;
                mesh.position.z += 1.5;
            }
        } else {
            car.state = 'DRIVING';
            car.speed = 5;
            this.pickNewDriveTarget(car);
        }

        this.world.scene.add(mesh);
        this.cars.push(car);
        return car;
    }

    spawnPedestrian(pos = null) {
        const mesh = new THREE.Mesh(this.pedGeo, this.pedMat);
        mesh.castShadow = true;
        
        if (!pos) {
            // Find a random spot not on road (ideally)
            pos = this.world.city.getRandomRoadPoint();
            // Offset to sidewalk
            pos.x += (Math.random() > 0.5 ? 2.5 : -2.5);
            pos.z += (Math.random() > 0.5 ? 2.5 : -2.5);
        }
        
        mesh.position.copy(pos);
        mesh.position.y = 0.5;
        
        const ped = new Pedestrian(mesh);
        this.pickWanderTarget(ped);
        
        this.world.scene.add(mesh);
        this.pedestrians.push(ped);
        return ped;
    }

    update(dt) {
        this.updateCars(dt);
        this.updatePedestrians(dt);
        this.stats.cars = this.cars.length;
        this.stats.pop = this.pedestrians.filter(p => p.state !== 'DRIVING').length;
    }

    updateCars(dt) {
        this.cars.forEach(car => {
            if (car.state === 'PARKED') return;

            // Move forward
            const dist = car.speed * dt;
            const move = car.dir.clone().multiplyScalar(dist);
            car.mesh.position.add(move);

            // Simple boundary/turning logic
            if (car.mesh.position.distanceTo(car.target) < 1) {
                if (car.state === 'FINDING_SPOT') {
                    // Park here
                    car.state = 'PARKED';
                    car.speed = 0;
                    // Align to curb visual
                    // Eject passenger
                    this.spawnPedestrian(car.mesh.position.clone().add(new THREE.Vector3(1.5, 0, 0)));
                } else {
                    this.pickNewDriveTarget(car);
                    // Occasionally decide to park
                    if (Math.random() < 0.1) {
                        car.state = 'FINDING_SPOT';
                    }
                }
            }
            
            // Map boundaries wrap
            if(Math.abs(car.mesh.position.x) > 40) car.mesh.position.x *= -0.95;
            if(Math.abs(car.mesh.position.z) > 40) car.mesh.position.z *= -0.95;
        });
    }

    pickNewDriveTarget(car) {
        // Simple Manhattan movement: Pick a point further along an axis
        const axes = [new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0), new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1)];
        // Prefer current direction
        if (Math.random() > 0.3) {
            // keep going same axis
        } else {
            // switch axis
            const axis = axes[Math.floor(Math.random()*axes.length)];
            car.dir.copy(axis);
            
            // Rotate mesh
            if(car.dir.z === 1) car.mesh.rotation.y = 0;
            if(car.dir.z === -1) car.mesh.rotation.y = Math.PI;
            if(car.dir.x === 1) car.mesh.rotation.y = Math.PI/2;
            if(car.dir.x === -1) car.mesh.rotation.y = -Math.PI/2;
        }
        
        car.target.copy(car.mesh.position).add(car.dir.clone().multiplyScalar(20));
        car.speed = 5;
    }

    updatePedestrians(dt) {
        this.pedestrians.forEach(ped => {
            if (ped.state === 'DRIVING') {
                ped.mesh.visible = false;
                ped.mesh.position.copy(ped.targetCar.mesh.position); // Follow car just in case we need to respawn
                return;
            } else {
                ped.mesh.visible = true;
            }

            const distToTarget = ped.mesh.position.distanceTo(ped.target);
            
            // Move
            if (distToTarget > 0.5) {
                const dir = new THREE.Vector3().subVectors(ped.target, ped.mesh.position).normalize();
                ped.mesh.position.add(dir.multiplyScalar(ped.speed * dt));
                ped.mesh.lookAt(ped.target);
            } else {
                // Reached target
                if (ped.state === 'GOING_TO_CAR') {
                    // Enter car
                    if (ped.targetCar && ped.targetCar.state === 'PARKED') {
                        ped.state = 'DRIVING';
                        ped.targetCar.state = 'DRIVING';
                        ped.targetCar.passenger = ped;
                        this.pickNewDriveTarget(ped.targetCar);
                    } else {
                        // Car left or invalid, wander
                        this.pickWanderTarget(ped);
                    }
                } else {
                    // Was wandering, choose new action
                    if (Math.random() < 0.3) {
                        // Try to find a car
                        const parkedCar = this.findNearestParkedCar(ped.mesh.position);
                        if (parkedCar) {
                            ped.state = 'GOING_TO_CAR';
                            ped.targetCar = parkedCar;
                            ped.target.copy(parkedCar.mesh.position);
                        } else {
                            this.pickWanderTarget(ped);
                        }
                    } else {
                        this.pickWanderTarget(ped);
                    }
                }
            }
        });
    }

    pickWanderTarget(ped) {
        ped.state = 'WANDERING';
        ped.targetCar = null;
        // Random nearby point
        ped.target.x = ped.mesh.position.x + (Math.random() * 20 - 10);
        ped.target.z = ped.mesh.position.z + (Math.random() * 20 - 10);
        
        // Clamp to city bounds roughly
        ped.target.x = Math.max(-30, Math.min(30, ped.target.x));
        ped.target.z = Math.max(-30, Math.min(30, ped.target.z));
    }

    findNearestParkedCar(pos) {
        let best = null;
        let bestDist = 20; // Search radius
        for (const car of this.cars) {
            if (car.state === 'PARKED') {
                const d = pos.distanceTo(car.mesh.position);
                if (d < bestDist) {
                    bestDist = d;
                    best = car;
                }
            }
        }
        return best;
    }

    getRandomPedestrian() {
        if (this.pedestrians.length === 0) return null;
        // Filter active ones (visible)
        const active = this.pedestrians.filter(p => p.state !== 'DRIVING');
        if (active.length === 0) return this.pedestrians[0];
        return active[Math.floor(Math.random() * active.length)];
    }
}