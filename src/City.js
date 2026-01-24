import * as THREE from 'three';

export class City {
    constructor() {
        this.group = new THREE.Group();
        
        // Scale Config
        this.cellSize = 80; // Total cell size (Road + Block)
        this.roadWidth = 16; // 8 units per lane roughly
        this.blockSize = this.cellSize - this.roadWidth;
        this.mapRadius = 5; // How many chunks out from center
        
        // Graph for Traffic
        this.intersections = []; 
        this.lanes = [];
        this.trafficLights = [];
        this.parkingSpots = [];
    }

    generate() {
        // Clear
        while(this.group.children.length > 0){ 
            this.group.remove(this.group.children[0]); 
        }
        this.intersections = [];
        this.lanes = [];
        this.trafficLights = [];
        this.parkingSpots = [];

        // Materials
        const matRoad = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
        
        // Create Intersection Nodes
        // Grid from -radius to +radius
        for(let x = -this.mapRadius; x <= this.mapRadius; x++) {
            for(let z = -this.mapRadius; z <= this.mapRadius; z++) {
                // Determine Density
                const dist = Math.sqrt(x*x + z*z);
                let type = 'CITY';
                if(dist > 2) type = 'SUBURB';
                if(dist > 4) type = 'COUNTRY';

                const wx = x * this.cellSize;
                const wz = z * this.cellSize;

                // Create Intersection Data
                const intersection = {
                    id: `${x}:${z}`,
                    x: x, z: z,
                    pos: new THREE.Vector3(wx, 0, wz),
                    type: type,
                    lights: { state: 'NS_GREEN', timer: 0 },
                    outLanes: [] // Lanes starting from here
                };
                this.intersections.push(intersection);

                // Visuals for this Cell (The road to the right and bottom, and the block content)
                // Actually, let's visualize the block at (x,z) and the roads surrounding it.
                // We'll treat (x,z) as the intersection center.
                
                // Intersection Mesh (Ground)
                const iGeo = new THREE.PlaneGeometry(this.roadWidth, this.roadWidth);
                const iMesh = new THREE.Mesh(iGeo, matRoad);
                iMesh.rotation.x = -Math.PI/2;
                iMesh.position.set(wx, 0.05, wz);
                iMesh.receiveShadow = true;
                this.group.add(iMesh);

                // Add Traffic Lights geometry if City
                if (type === 'CITY' || type === 'SUBURB') {
                    this.createTrafficLightVisuals(intersection);
                    this.trafficLights.push(intersection);
                }
            }
        }

        // Link Intersections and Create Roads/Lanes
        this.intersections.forEach(node => {
            // Link to Right (x+1)
            if (node.x < this.mapRadius) {
                const neighbor = this.getIntersection(node.x + 1, node.z);
                if (neighbor) this.createRoadSegment(node, neighbor, 'HORIZONTAL');
            }
            // Link to Bottom (z+1)
            if (node.z < this.mapRadius) {
                const neighbor = this.getIntersection(node.x, node.z + 1);
                if (neighbor) this.createRoadSegment(node, neighbor, 'VERTICAL');
            }
        });

        // Fill in Blocks (The space between intersections)
        // A block is "top-left" of the intersection? No, let's place blocks in the centers of grid cells.
        // Grid cell (x,z) to (x+1, z+1) contains a block.
        for(let x = -this.mapRadius; x < this.mapRadius; x++) {
            for(let z = -this.mapRadius; z < this.mapRadius; z++) {
                this.generateBlock(x, z);
            }
        }
    }

    getIntersection(x, z) {
        return this.intersections.find(i => i.x === x && i.z === z);
    }

    createRoadSegment(nodeA, nodeB, orientation) {
        const matRoad = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
        const matLine = new THREE.MeshBasicMaterial({ color: 0xffffff });
        
        // Geometry
        const length = this.cellSize - this.roadWidth;
        const midX = (nodeA.pos.x + nodeB.pos.x) / 2;
        const midZ = (nodeA.pos.z + nodeB.pos.z) / 2;
        
        const roadGeo = new THREE.PlaneGeometry(
            orientation === 'HORIZONTAL' ? length : this.roadWidth,
            orientation === 'HORIZONTAL' ? this.roadWidth : length
        );
        const road = new THREE.Mesh(roadGeo, matRoad);
        road.rotation.x = -Math.PI/2;
        road.position.set(midX, 0.05, midZ);
        road.receiveShadow = true;
        this.group.add(road);

        // Center dashed line
        const lineGeo = new THREE.PlaneGeometry(
            orientation === 'HORIZONTAL' ? length : 0.5,
            orientation === 'HORIZONTAL' ? 0.5 : length
        );
        const line = new THREE.Mesh(lineGeo, matLine);
        line.rotation.x = -Math.PI/2;
        line.position.set(midX, 0.06, midZ);
        this.group.add(line);

        // Crosswalks
        // Add white stripes at both ends of the road segment
        this.createCrosswalks(midX, midZ, length, orientation);

        // Logic: Lanes
        // Lane 1: A -> B (Right side relative to A)
        // Lane 2: B -> A (Right side relative to B)
        const offset = this.roadWidth / 4; // Center of the right lane

        if (orientation === 'HORIZONTAL') {
            // A -> B (Moving +X, z offset +)
            this.lanes.push({
                start: new THREE.Vector3(nodeA.pos.x + this.roadWidth/2, 0, nodeA.pos.z + offset),
                end: new THREE.Vector3(nodeB.pos.x - this.roadWidth/2, 0, nodeB.pos.z + offset),
                dir: new THREE.Vector3(1, 0, 0),
                from: nodeA, to: nodeB
            });
            // B -> A (Moving -X, z offset -)
            this.lanes.push({
                start: new THREE.Vector3(nodeB.pos.x - this.roadWidth/2, 0, nodeB.pos.z - offset),
                end: new THREE.Vector3(nodeA.pos.x + this.roadWidth/2, 0, nodeA.pos.z - offset),
                dir: new THREE.Vector3(-1, 0, 0),
                from: nodeB, to: nodeA
            });
        } else {
            // A -> B (Moving +Z, x offset -)
            this.lanes.push({
                start: new THREE.Vector3(nodeA.pos.x - offset, 0, nodeA.pos.z + this.roadWidth/2),
                end: new THREE.Vector3(nodeB.pos.x - offset, 0, nodeB.pos.z - this.roadWidth/2),
                dir: new THREE.Vector3(0, 0, 1),
                from: nodeA, to: nodeB
            });
            // B -> A (Moving -Z, x offset +)
            this.lanes.push({
                start: new THREE.Vector3(nodeB.pos.x + offset, 0, nodeB.pos.z - this.roadWidth/2),
                end: new THREE.Vector3(nodeA.pos.x + offset, 0, nodeA.pos.z + this.roadWidth/2),
                dir: new THREE.Vector3(0, 0, -1),
                from: nodeB, to: nodeA
            });
        }
    }

    generateBlock(gridX, gridZ) {
        // Center of the block
        const cx = (gridX + 0.5) * this.cellSize;
        const cz = (gridZ + 0.5) * this.cellSize;
        
        // Determine Density/Type based on center of block
        const dist = Math.sqrt(cx*cx + cz*cz) / this.cellSize;
        
        // Base Ground (Sidewalk or Grass)
        const size = this.blockSize;
        let isCountry = dist > 4;
        let isSuburb = dist > 2 && !isCountry;
        
        const matGround = isCountry ? 
            new THREE.MeshLambertMaterial({ color: 0x3b7d38 }) : 
            new THREE.MeshLambertMaterial({ color: 0x95a5a6 }); // Sidewalk gray

        const baseGeo = new THREE.BoxGeometry(size, 0.5, size);
        const base = new THREE.Mesh(baseGeo, matGround);
        base.position.set(cx, 0.25, cz);
        base.receiveShadow = true;
        this.group.add(base);

        if (isCountry) {
            // Random Trees
            const numTrees = Math.floor(Math.random() * 10);
            for(let i=0; i<numTrees; i++) {
                const tx = cx + (Math.random() - 0.5) * (size - 2);
                const tz = cz + (Math.random() - 0.5) * (size - 2);
                const tree = this.createTree();
                tree.position.set(tx, 0.5, tz);
                this.group.add(tree);
            }
            return;
        }

        // City/Suburb: Buildings or Parking
        // 10% chance of Parking Lot in city
        if (Math.random() < 0.1 && !isSuburb) {
            // Parking Lot
            const lotGeo = new THREE.PlaneGeometry(size - 4, size - 4);
            const lotMat = new THREE.MeshLambertMaterial({ color: 0x34495e });
            const lot = new THREE.Mesh(lotGeo, lotMat);
            lot.rotation.x = -Math.PI/2;
            lot.position.set(cx, 0.52, cz);
            this.group.add(lot);
            
            // Add parking spots for spawn logic
            for(let px = -1; px <= 1; px+=2) {
                for(let pz = -1; pz <= 1; pz++) {
                    this.parkingSpots.push(new THREE.Vector3(
                        cx + px * 10, 0.5, cz + pz * 10
                    ));
                }
            }
            return;
        }

        // Buildings
        // Subdivide block? Or one big building?
        // Let's do a mix.
        const numBuildings = isSuburb ? 4 : (Math.random() > 0.5 ? 1 : 4);
        
        if (numBuildings === 1) {
            // Skyscraper or large building
            const h = isSuburb ? 6 + Math.random()*5 : 20 + Math.random() * 40;
            const bSize = size - 6;
            this.createBuilding(cx, 0.5, cz, bSize, h, bSize);
        } else {
            // 4 quadrants
            const bSize = (size / 2) - 4;
            const hBase = isSuburb ? 5 : 15;
            
            [[1,1], [1,-1], [-1,1], [-1,-1]].forEach(([qx, qz]) => {
                if (Math.random() > 0.3) {
                    const h = hBase + Math.random() * 10;
                    this.createBuilding(
                        cx + qx * (size/4), 
                        0.5, 
                        cz + qz * (size/4), 
                        bSize, h, bSize
                    );
                }
            });
        }
    }

    createBuilding(x, y, z, w, h, d) {
        const geo = new THREE.BoxGeometry(w, h, d);
        const col = [0xbdc3c7, 0xecf0f1, 0x95a5a6][Math.floor(Math.random()*3)];
        const mat = new THREE.MeshLambertMaterial({ color: col });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y + h/2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.group.add(mesh);
    }

    createCrosswalks(midX, midZ, length, orientation) {
        const stripeGeo = new THREE.PlaneGeometry(
            orientation === 'HORIZONTAL' ? 2 : this.roadWidth * 0.8, 
            orientation === 'HORIZONTAL' ? this.roadWidth * 0.8 : 2
        );
        const matWhite = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
        
        // We want stripes. Let's just do a solid transparent white block for now to represent the zone, 
        // or a group of stripes. Let's do a group of stripes.
        const numStripes = 6;
        const stripeW = orientation === 'HORIZONTAL' ? 1.5 : (this.roadWidth / numStripes) * 0.6;
        const stripeH = orientation === 'HORIZONTAL' ? (this.roadWidth / numStripes) * 0.6 : 1.5;
        
        const group = new THREE.Group();
        
        // Create a pattern of stripes
        for(let i=0; i<numStripes; i++) {
            const sGeo = new THREE.PlaneGeometry(stripeW, stripeH);
            const sMesh = new THREE.Mesh(sGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
            sMesh.rotation.x = -Math.PI/2;
            
            // Position within the group
            // If Horizontal Road: stripes span vertically (z), spaced along z
            // If Vertical Road: stripes span horizontally (x), spaced along x
            
            let lx=0, lz=0;
            const spread = this.roadWidth * 0.8;
            const offset = (i / (numStripes - 1)) * spread - spread/2;
            
            if (orientation === 'HORIZONTAL') {
                lz = offset;
            } else {
                lx = offset;
            }
            sMesh.position.set(lx, 0, lz);
            group.add(sMesh);
        }

        // Place two groups: One at start, one at end
        const dist = length / 2 - 2; // 2 units from the intersection edge
        
        const c1 = group.clone();
        if (orientation === 'HORIZONTAL') c1.position.set(midX - dist, 0.07, midZ);
        else c1.position.set(midX, 0.07, midZ - dist);
        
        const c2 = group.clone();
        if (orientation === 'HORIZONTAL') c2.position.set(midX + dist, 0.07, midZ);
        else c2.position.set(midX, 0.07, midZ + dist);
        
        this.group.add(c1);
        this.group.add(c2);
    }

    createTree() {
        const group = new THREE.Group();
        const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 3, 6);
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5d4037 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.5;
        
        const leavesGeo = new THREE.ConeGeometry(3, 6, 8);
        const leavesMat = new THREE.MeshLambertMaterial({ color: 0x2e7d32 });
        const leaves = new THREE.Mesh(leavesGeo, leavesMat);
        leaves.position.y = 4.5;
        
        group.add(trunk);
        group.add(leaves);
        return group;
    }

    createTrafficLightVisuals(node) {
        const poleGeo = new THREE.CylinderGeometry(0.5, 0.5, 12);
        const poleMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
        const boxGeo = new THREE.BoxGeometry(2, 4, 2);
        const boxMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        
        // Place 4 poles at corners
        const offset = this.roadWidth / 2 + 1;
        
        const poles = [
            { x: offset, z: offset },
            { x: -offset, z: -offset },
            { x: offset, z: -offset },
            { x: -offset, z: offset }
        ];

        poles.forEach(p => {
            const pole = new THREE.Mesh(poleGeo, poleMat);
            pole.position.set(node.pos.x + p.x, 6, node.pos.z + p.z);
            this.group.add(pole);
            
            const box = new THREE.Mesh(boxGeo, boxMat);
            box.position.set(0, 5, 0); // relative to pole top? No, absolute
            box.position.copy(pole.position);
            box.position.y = 10;
            this.group.add(box);
            
            // Store ref to box to change color? 
            // For simplicity, we just simulate logic, visuals are static grey boxes with colored spheres for now
            // Adding a sphere that changes color would be better
            const lightGeo = new THREE.SphereGeometry(0.8);
            const lightMesh = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
            lightMesh.position.set(0, 0, 0.8); // Face out?
            // This is getting complex for rotation. Let's just put a floating glowing orb in center of intersection.
        });
        
        // Central Hanging Light (Simpler visual indicator)
        const centerGeo = new THREE.BoxGeometry(2, 2, 2);
        node.mesh = new THREE.Mesh(centerGeo, new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
        node.mesh.position.set(node.pos.x, 10, node.pos.z);
        this.group.add(node.mesh);
    }

    update(dt) {
        // Traffic Lights Cycle
        const cycleTime = 10; // seconds
        this.trafficLights.forEach(node => {
            node.lights.timer += dt;
            if (node.lights.timer > cycleTime) {
                node.lights.timer = 0;
                // Toggle
                node.lights.state = (node.lights.state === 'NS_GREEN') ? 'EW_GREEN' : 'NS_GREEN';
                
                // Update visual
                if (node.mesh) {
                    node.mesh.material.color.setHex(node.lights.state === 'NS_GREEN' ? 0x00ff00 : 0xff0000);
                    // Green means NS is Green. So if we are NS lane, we go.
                    // Visual explanation: Green box = NS Green. Red box = EW Green.
                }
            }
        });
    }

    getRandomRoadPoint() {
        // Find a random lane
        if (this.lanes.length === 0) return new THREE.Vector3();
        const lane = this.lanes[Math.floor(Math.random() * this.lanes.length)];
        return lane.start.clone();
    }
}