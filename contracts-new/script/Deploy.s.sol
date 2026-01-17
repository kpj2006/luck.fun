// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {RugsFun} from "../src/core/RugsFun.sol";
import {GameManager} from "../src/core/GameManager.sol";
import {Treasury} from "../src/core/Treasury.sol";

/**
 * @title Deploy
 * @notice Deployment script for Rugs.Fun contracts
 * @dev Run with: forge script script/Deploy.s.sol --rpc-url <RPC_URL> --broadcast --verify
 */
contract Deploy is Script {
    // Deployment addresses (to be configured)
    address public deployer;
    address public owner;
    address public operator; // Backend server address
    address public gameToken; // ERC20 token address

    function setUp() public {
        // Load from environment variables
        deployer = vm.envOr("DEPLOYER_ADDRESS", msg.sender);
        owner = vm.envOr("OWNER_ADDRESS", deployer);
        operator = vm.envOr("OPERATOR_ADDRESS", deployer);
        gameToken = vm.envOr("GAME_TOKEN_ADDRESS", address(0));

        console2.log("=== Deployment Configuration ===");
        console2.log("Deployer:", deployer);
        console2.log("Owner:", owner);
        console2.log("Operator:", operator);
        console2.log("Game Token:", gameToken);
        console2.log("");
    }

    function run() public {
        // Validate configuration
        require(gameToken != address(0), "GAME_TOKEN_ADDRESS not set");
        require(owner != address(0), "OWNER_ADDRESS not set");
        require(operator != address(0), "OPERATOR_ADDRESS not set");

        // Start broadcasting transactions
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        console2.log("=== Starting Deployment ===");
        console2.log("");

        // 1. Deploy Treasury (needs to know game token)
        console2.log("1. Deploying Treasury...");
        Treasury treasury = new Treasury(
            gameToken,
            owner, // Temporary - will set to GameManager later
            owner
        );
        console2.log("   Treasury deployed at:", address(treasury));
        console2.log("");

        // 2. Deploy RugsFun (main contract)
        console2.log("2. Deploying RugsFun...");
        RugsFun rugsFun = new RugsFun(
            gameToken,
            address(treasury),
            owner
        );
        console2.log("   RugsFun deployed at:", address(rugsFun));
        console2.log("");

        // 3. Deploy GameManager
        console2.log("3. Deploying GameManager...");
        GameManager gameManager = new GameManager(
            address(rugsFun),
            address(treasury),
            operator,
            owner
        );
        console2.log("   GameManager deployed at:", address(gameManager));
        console2.log("");

        // 4. Configure Treasury and RugsFun
        console2.log("4. Configuring Treasury and RugsFun...");
        treasury.setFeeCollector(address(gameManager));
        console2.log("   Treasury Fee collector set to GameManager");
        
        rugsFun.setGameManager(address(gameManager));
        console2.log("   RugsFun Game manager set to GameManager");
        console2.log("");

        vm.stopBroadcast();

        // Print deployment summary
        console2.log("=== Deployment Summary ===");
        console2.log("Game Token:", gameToken);
        console2.log("RugsFun:", address(rugsFun));
        console2.log("GameManager:", address(gameManager));
        console2.log("Treasury:", address(treasury));
        console2.log("");
        console2.log("Owner:", owner);
        console2.log("Operator:", operator);
        console2.log("");

        // Print contract verification commands
        console2.log("=== Verification Commands ===");
        console2.log("forge verify-contract", address(treasury), "src/core/Treasury.sol:Treasury --chain-id <CHAIN_ID>");
        console2.log("forge verify-contract", address(rugsFun), "src/core/RugsFun.sol:RugsFun --chain-id <CHAIN_ID>");
        console2.log("forge verify-contract", address(gameManager), "src/core/GameManager.sol:GameManager --chain-id <CHAIN_ID>");
        console2.log("");

        // Save deployment addresses to file
        _saveDeploymentAddresses(
            address(rugsFun),
            address(gameManager),
            address(treasury)
        );
    }

    function _saveDeploymentAddresses(
        address rugsFunAddr,
        address gameManagerAddr,
        address treasuryAddr
    ) internal {
        string memory json = string.concat(
            '{\n',
            '  "gameToken": "', vm.toString(gameToken), '",\n',
            '  "rugsFun": "', vm.toString(rugsFunAddr), '",\n',
            '  "gameManager": "', vm.toString(gameManagerAddr), '",\n',
            '  "treasury": "', vm.toString(treasuryAddr), '",\n',
            '  "owner": "', vm.toString(owner), '",\n',
            '  "operator": "', vm.toString(operator), '",\n',
            '  "deployedAt": "', vm.toString(block.timestamp), '"\n',
            '}'
        );

        string memory filename = string.concat("./deployments/deployments-", vm.toString(block.chainid), ".json");
        vm.writeFile(filename, json);
        
        console2.log("Deployment addresses saved to:", filename);
    }
}
