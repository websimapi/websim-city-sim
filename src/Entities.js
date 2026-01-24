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
    constructor(mesh, blockX, blockZ) {
        this.mesh = mesh;
        this.speed = 4;
        this.state = 'WALKING'; // WALKING, WAITING, CROSSING
        
        // Animation
        this.limbs = {
            armL: mesh.getObjectByName('ArmL'),
            armR: mesh.getObjectByName('ArmR'),
            legL: mesh.getObjectByName('LegL'),
            legR: mesh.getObjectByName('LegR')
        };
        this.animTime = Math.random() * 100;

        // Pathfinding
        this.blockX = blockX;
        this.blockZ = blockZ;
        this.target = new THREE.Vector3();
        this.targetCorner = Math.floor(Math.random() * 4); // 0..3
        this.waitTimer = 0;
    }
}

export class EntityManager {
    constructor(world) {
        this.world = world;
        this.cars = [];
        this.pedestrians = [];
        
        // New Larger Scales
        this.carGeo = new THREE.BoxGeometry(2, 1.5, 4.5);
        
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
        const { mesh, skin } = this.createVoxelCharacter();
        
        // Pick random block
        const r = this.world.city.mapRadius - 1;
        const bx = Math.floor((Math.random() * r * 2) - r);
        const bz = Math.floor((Math.random() * r * 2) - r);
        
        const ped = new Pedestrian(mesh, bx, bz);
        
        // Set initial pos to a corner
        const cornerPos = this.getCornerPos(bx, bz, ped.targetCorner);
        mesh.position.copy(cornerPos);
        mesh.position.y = 0.9;
        
        // Pick next target
        this.pickNextPedTarget(ped);
        
        this.world.scene.add(mesh);
        this.pedestrians.push(ped);
    }

    createVoxelCharacter() {
        const group = new THREE.Group();
        
        // Minecraft-style proportions (approx)
        // 1 unit high total
        const skinColor = [0xffccaa, 0x8d5524, 0xc68642, 0xe0ac69][Math.floor(Math.random()*4)];
        const shirtColor = Math.random() * 0xffffff;
        const pantsColor = Math.random() * 0xffffff;
        
        const matSkin = new THREE.MeshLambertMaterial({ color: skinColor });
        const matShirt = new THREE.MeshLambertMaterial({ color: shirtColor });
        const matPants = new THREE.MeshLambertMaterial({ color: pantsColor });
        
        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), matSkin);
        head.position.y = 0.875;
        head.castShadow = true;
        group.add(head);
        
        // Body
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.375, 0.125), matShirt);
        body.position.y = 0.5625;
        body.castShadow = true;
        group.add(body);
        
        // Arms
        const armGeo = new THREE.BoxGeometry(0.1, 0.375, 0.1);
        const armL = new THREE.Mesh(armGeo, matShirt);
        armL.position.set(-0.175, 0.5625, 0);
        armL.name = 'ArmL';
        armL.castShadow = true;
        group.add(armL);
        
        const armR = new THREE.Mesh(armGeo, matShirt);
        armR.position.set(0.175, 0.5625, 0);
        armR.name = 'ArmR';
        armR.castShadow = true;
        group.add(armR);
        
        // Legs
        const legGeo = new THREE.BoxGeometry(0.1, 0.375, 0.1);
        const legL = new THREE.Mesh(legGeo, matPants);
        legL.position.set(-0.075, 0.1875, 0);
        legL.name = 'LegL';
        legL.castShadow = true;
        group.add(legL);
        
        const legR = new THREE.Mesh(legGeo, matPants);
        legR.position.set(0.075, 0.1875, 0);
        legR.name = 'LegR';
        legR.castShadow = true;
        group.add(legR);
        
        return { mesh: group };
    }
    
    getCornerPos(bx, bz, cornerIdx) {
        // Block Center
        const cs = this.world.city.cellSize;
        const bs = this.world.city.blockSize;
        const cx = (bx + 0.5) * cs;
        const cz = (bz + 0.5) * cs;
        
        // Offset for sidewalk (edge of block)
        const d = bs / 2 + 0.5; // Slightly outside building zone
        
        const v = new THREE.Vector3(cx, 0.9, cz);
        switch(cornerIdx) {
            case 0: v.x += d; v.z -= d; break; // TR (Top Right in 2D, +X -Z)
            case 1: v.x += d; v.z += d; break; // BR (+X +Z)
            case 2: v.x -= d; v.z += d; break; // BL (-X +Z)
            case 3: v.x -= d; v.z -= d; break; // TL (-X -Z)
        }
        return v;
    }
    
    pickNextPedTarget(ped) {
        // Logic: 
        // 1. Move to next corner of current block (Orbit)
        // 2. Chance to cross street at current corner
        
        // We are currently AT ped.targetCorner (or spawned there).
        // Let's find the Intersection near this corner.
        
        // Corner 0 (+x, -z) is near Intersection (x+1, z)
        // Corner 1 (+x, +z) is near Intersection (x+1, z+1)
        // Corner 2 (-x, +z) is near Intersection (x, z+1)
        // Corner 3 (-x, -z) is near Intersection (x, z)
        
        let ix = ped.blockX;
        let iz = ped.blockZ;
        
        if (ped.targetCorner === 0 || ped.targetCorner === 1) ix++;
        if (ped.targetCorner === 1 || ped.targetCorner === 2) iz++;
        
        const intersection = this.world.city.getIntersection(ix, iz);
        
        // Chance to cross if intersection exists
        let crossing = false;
        if (intersection && Math.random() < 0.3) {
            // Determine Crossing Target
            // Corner 0 at (x,z) -> Cross X (to x+1 block) OR Cross Z (to z-1 block)
            // Simpler: Just try to cross to the block that shares this intersection
            
            // Example: At Corner 0 of Block (0,0). Neighbors are Block (1,0) [Right] and Block (0,-1) [Top].
            // Let's pick a random direction
            const dir = Math.random() < 0.5 ? 'H' : 'V'; // H = Cross X-road, V = Cross Z-road (Wait, terminology)
            
            // Cross Horizontal Road (Moving Vertically Z-axis)
            // Cross Vertical Road (Moving Horizontally X-axis)
            
            let tx = ped.blockX;
            let tz = ped.blockZ;
            let tc = 0;
            
            let safeToCross = false;
            
            // Note: Parallel traffic green = Cross green.
            // If cars on NS road are Green, I can walk along NS road (Crossing EW road).
            
            if (dir === 'H') {
                // Moving Horizontally (Change X). Crossing a Vertical Road.
                // Need EW_GREEN traffic? NO. Cars on vertical road (NS) must be RED.
                // If NS cars are Red, EW cars are Green.
                // So if I cross a Vertical road, I am moving Horizontal. I want EW traffic to be green.
                
                // Which block is neighbour?
                if (ped.targetCorner === 0 || ped.targetCorner === 1) tx += 1; else tx -= 1;
                
                // New Corner? Mirror X. 0->3, 1->2, 2->1, 3->0
                tc = [3, 2, 1, 0][ped.targetCorner];
                
                // Check Lights
                // Crossing Vertical Road -> Need Horizontal Green (EW_GREEN)
                if (intersection.lights.state === 'EW_GREEN') safeToCross = true;
            } else {
                // Moving Vertically (Change Z). Crossing a Horizontal Road.
                // Need NS traffic to be Green (cars parallel to me).
                
                if (ped.targetCorner === 1 || ped.targetCorner === 2) tz += 1; else tz -= 1;
                
                // New Corner? Mirror Z. 0->1, 1->0, 2->3, 3->2
                tc = [1, 0, 3, 2][ped.targetCorner];
                
                if (intersection.lights.state === 'NS_GREEN') safeToCross = true;
            }
            
            if (safeToCross) {
                ped.state = 'CROSSING';
                ped.blockX = tx;
                ped.blockZ = tz;
                ped.targetCorner = tc;
                ped.target.copy(this.getCornerPos(tx, tz, tc));
                return;
            } else {
                // Want to cross but light is red. Wait.
                ped.state = 'WAITING';
                ped.waitTimer = Math.random() * 2 + 1; // Re-evaluate shortly
                ped.target.copy(ped.mesh.position); // Stay put
                return;
            }
        }
        
        // Walk around block
        ped.state = 'WALKING';
        ped.targetCorner = (ped.targetCorner + 1) % 4;
        ped.target.copy(this.getCornerPos(ped.blockX, ped.blockZ, ped.targetCorner));
    }

    update(dt) {
        this.updateCars(dt);
        this.updatePedestrians(dt);
        this.stats.cars = this.cars.length;
        this.stats.pop = this.pedestrians.length;
    }

    updateCars(dt) {
        const LANE_LENGTH = this.world.city.cellSize - this.world.city.roadWidth;
        // Stop slightly before the intersection (crosswalk area)
        // Crosswalk is ~2-4 units wide. Lane end is at intersection edge.
        // Let's stop at t=0.85
        const STOP_LINE = 0.85; 

        this.cars.forEach(car => {
            if (car.state === 'DRIVING') {
                car.t += (car.speed * dt) / LANE_LENGTH;

                // Check for stop light approach
                if (car.t > STOP_LINE && car.t < 1) {
                     const intersection = car.currentLane.to;
                     const isHorizontal = Math.abs(car.currentLane.dir.x) > 0.5;
                     const greenForMe = (intersection.lights.state === 'EW_GREEN' && isHorizontal) ||
                                       (intersection.lights.state === 'NS_GREEN' && !isHorizontal);
                     
                     if (!greenForMe) {
                         // Red light, stop here
                         car.t = STOP_LINE;
                         car.state = 'WAITING';
                     }
                }

                if (car.t >= 1) {
                    // Reached Intersection (Past crosswalk, entering junction)
                    car.t = 1;
                    const intersection = car.currentLane.to;
                    
                    // Already checked lights at STOP_LINE, but check if we can proceed (e.g. if we were waiting right at line)
                    // If we are at t=1, we are IN the intersection, so we turn.
                    
                    const nextLanes = this.world.city.lanes.filter(l => l.from === intersection && l !== car.currentLane);
                    if (nextLanes.length > 0) {
                        const nextLane = nextLanes[Math.floor(Math.random() * nextLanes.length)];
                        car.state = 'TURNING';
                        car.nextLane = nextLane;
                        car.curveT = 0;
                        const p0 = car.currentLane.end;
                        const p2 = nextLane.start;
                        const p1 = intersection.pos; 
                        car.curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
                    } else {
                        car.t = 0; // Loop/Reset
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
                const intersection = car.currentLane.to;
                const isHorizontal = Math.abs(car.currentLane.dir.x) > 0.5;
                const greenForMe = (intersection.lights.state === 'EW_GREEN' && isHorizontal) ||
                                   (intersection.lights.state === 'NS_GREEN' && !isHorizontal);
                
                if (greenForMe) {
                    car.state = 'DRIVING';
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
            // Animation
            ped.animTime += dt * ped.speed * 2;
            if (ped.state !== 'WAITING') {
                // Swing limbs
                const armAngle = Math.sin(ped.animTime) * 0.5;
                const legAngle = Math.sin(ped.animTime) * 0.5;
                if(ped.limbs.armL) ped.limbs.armL.rotation.x = armAngle;
                if(ped.limbs.armR) ped.limbs.armR.rotation.x = -armAngle;
                if(ped.limbs.legL) ped.limbs.legL.rotation.x = -legAngle;
                if(ped.limbs.legR) ped.limbs.legR.rotation.x = legAngle;
            } else {
                // Reset pose
                if(ped.limbs.armL) ped.limbs.armL.rotation.x = 0;
                if(ped.limbs.armR) ped.limbs.armR.rotation.x = 0;
                if(ped.limbs.legL) ped.limbs.legL.rotation.x = 0;
                if(ped.limbs.legR) ped.limbs.legR.rotation.x = 0;
            }

            if (ped.state === 'WAITING') {
                ped.waitTimer -= dt;
                if (ped.waitTimer <= 0) {
                    this.pickNextPedTarget(ped);
                }
                return;
            }

            const dist = ped.mesh.position.distanceTo(ped.target);
            if(dist < 0.5) {
                // Reached target
                this.pickNextPedTarget(ped);
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