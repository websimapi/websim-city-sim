import * as THREE from 'three';

export class City {
    constructor() {
        this.group = new THREE.Group();
        this.gridSize = 20; // 20x20 units total area
        this.blockSize = 4;
        this.roadWidth = 2;
        this.roads = []; // Array of {x, z, width, length, direction}
        this.spawnPoints = [];
    }

    generate() {
        // Clear existing
        while(this.group.children.length > 0){ 
            this.group.remove(this.group.children[0]); 
        }
        this.roads = [];
        this.spawnPoints = [];

        // Simple Grid Layout
        const numBlocks = 6;
        const totalSize = numBlocks * (this.blockSize + this.roadWidth);
        const offset = totalSize / 2;

        const materialGround = new THREE.MeshLambertMaterial({ color: 0x333333 }); // Road color
        const materialSidewalk = new THREE.MeshLambertMaterial({ color: 0x999999 });
        const buildingColors = [0xf1c40f, 0xe74c3c, 0x3498db, 0x2ecc71, 0x9b59b6, 0xffffff];

        // Ground Plane (Base)
        const planeGeo = new THREE.PlaneGeometry(totalSize + 20, totalSize + 20);
        const plane = new THREE.Mesh(planeGeo, new THREE.MeshLambertMaterial({ color: 0x2c3e50 }));
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = -0.1;
        this.group.add(plane);

        // Generate Grid
        for (let x = 0; x < numBlocks; x++) {
            for (let z = 0; z < numBlocks; z++) {
                const px = x * (this.blockSize + this.roadWidth) - offset;
                const pz = z * (this.blockSize + this.roadWidth) - offset;

                // Sidewalk/Block Base
                const swGeo = new THREE.BoxGeometry(this.blockSize, 0.2, this.blockSize);
                const sw = new THREE.Mesh(swGeo, materialSidewalk);
                sw.position.set(px + this.blockSize/2, 0.1, pz + this.blockSize/2);
                sw.receiveShadow = true;
                this.group.add(sw);

                // Buildings (randomize)
                if (Math.random() > 0.2) {
                    const height = Math.random() * 5 + 2;
                    const bGeo = new THREE.BoxGeometry(this.blockSize - 0.5, height, this.blockSize - 0.5);
                    const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];
                    const bMat = new THREE.MeshLambertMaterial({ color: color });
                    const building = new THREE.Mesh(bGeo, bMat);
                    building.position.set(px + this.blockSize/2, height/2 + 0.2, pz + this.blockSize/2);
                    building.castShadow = true;
                    building.receiveShadow = true;
                    this.group.add(building);
                } else {
                    // Park/Empty lot
                    const tGeo = new THREE.ConeGeometry(0.5, 2, 8);
                    const tMat = new THREE.MeshLambertMaterial({ color: 0x27ae60 });
                    const tree = new THREE.Mesh(tGeo, tMat);
                    tree.position.set(px + this.blockSize/2, 1, pz + this.blockSize/2);
                    this.group.add(tree);
                }
            }
        }
        
        // Define Roads for navigation (Grid lines)
        // Vertical roads
        for(let x = 0; x <= numBlocks; x++) {
            const rx = x * (this.blockSize + this.roadWidth) - offset - this.roadWidth/2;
            this.roads.push({
                x: rx, z: 0, 
                width: this.roadWidth, 
                length: totalSize, 
                vertical: true
            });
            // Visual road is just the gap, but we can add markings if needed
        }
        // Horizontal roads
        for(let z = 0; z <= numBlocks; z++) {
            const rz = z * (this.blockSize + this.roadWidth) - offset - this.roadWidth/2;
            this.roads.push({
                x: 0, z: rz,
                width: totalSize,
                length: this.roadWidth,
                vertical: false
            });
        }
    }

    getRandomRoadPoint() {
        // Pick a random road
        const road = this.roads[Math.floor(Math.random() * this.roads.length)];
        let x, z;
        if (road.vertical) {
            x = road.x;
            z = (Math.random() * road.length) - (road.length/2);
        } else {
            x = (Math.random() * road.width) - (road.width/2);
            z = road.z;
        }
        return new THREE.Vector3(x, 0.2, z);
    }
    
    // Check if position is on sidewalk
    isSidewalk(pos) {
        // Simple heuristic: if not on road, it's sidewalk or building
        // But for this simple grid, we just check against road bounds
        const roadThreshold = 1.2; // Slightly wider than road center
        
        let onRoad = false;
        // Check vertical roads
        for(let x = -30; x <= 30; x+=6) { // 4+2 spacing roughly
             if (Math.abs(pos.x - x) < 1.5) onRoad = true;
        }
        // Check horizontal
        for(let z = -30; z <= 30; z+=6) {
             if (Math.abs(pos.z - z) < 1.5) onRoad = true;
        }
        
        return !onRoad;
    }
}