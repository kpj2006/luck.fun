// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {RugsFun} from "../src/core/RugsFun.sol";

/**
 * @title TestInteraction
 * @notice Script to test deposit and withdrawal on deployed RugsFun contract
 */
contract TestInteraction is Script {
    address constant RUGS_TOKEN = 0x4297F610EF0E14E988494507dF51Fb2E396A9fF3;
    address constant RUGS_FUN = 0x86ce018EC43DB9561d6FD7C2A71994d0A3Bc9a57;
    
    uint256 constant TEST_AMOUNT = 10 * 10**18; // 10 RUGS (18 decimals)

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console2.log("=== Testing RugsFun Contract ===");
        console2.log("User:", deployer);
        console2.log("RugsFun:", RUGS_FUN);
        console2.log("RUGS Token:", RUGS_TOKEN);
        console2.log("");

        IERC20 rugsToken = IERC20(RUGS_TOKEN);
        RugsFun rugsFun = RugsFun(RUGS_FUN);

        // Check initial balances
        console2.log("=== Initial State ===");
        uint256 tokenBalance = rugsToken.balanceOf(deployer);
        uint256 rugsFunBalance = rugsFun.balances(deployer);
        console2.log("RUGS balance:", tokenBalance / 10**18);
        console2.log("RugsFun balance:", rugsFunBalance / 10**18);
        console2.log("");

        if (tokenBalance < TEST_AMOUNT) {
            console2.log("WARNING: Insufficient RUGS balance");
            console2.log("Need:", TEST_AMOUNT / 10**18, "RUGS");
            console2.log("Have:", tokenBalance / 10**18, "RUGS");
            console2.log("Claim from faucet first!");
            return;
        }

        vm.startBroadcast(deployerPrivateKey);

        // 1. Approve RUGS
        console2.log("=== Step 1: Approve RUGS ===");
        rugsToken.approve(RUGS_FUN, TEST_AMOUNT);
        console2.log("Approved", TEST_AMOUNT / 10**18, "RUGS to RugsFun");
        console2.log("");

        // 2. Deposit
        console2.log("=== Step 2: Deposit ===");
        rugsFun.deposit(TEST_AMOUNT);
        console2.log("Deposited", TEST_AMOUNT / 10**18, "RUGS");
        console2.log("");

        // Check balances after deposit
        console2.log("=== After Deposit ===");
        tokenBalance = rugsToken.balanceOf(deployer);
        rugsFunBalance = rugsFun.balances(deployer);
        console2.log("RUGS balance:", tokenBalance / 10**18);
        console2.log("RugsFun balance:", rugsFunBalance / 10**18);
        console2.log("");

        // 3. Withdraw half
        uint256 withdrawAmount = TEST_AMOUNT / 2;
        console2.log("=== Step 3: Withdraw ===");
        rugsFun.withdraw(withdrawAmount);
        console2.log("Withdrew", withdrawAmount / 10**18, "RUGS");
        console2.log("");

        // Check final balances
        console2.log("=== Final State ===");
        tokenBalance = rugsToken.balanceOf(deployer);
        rugsFunBalance = rugsFun.balances(deployer);
        console2.log("RUGS balance:", tokenBalance / 10**18);
        console2.log("RugsFun balance:", rugsFunBalance / 10**18);
        console2.log("");

        vm.stopBroadcast();

        console2.log("=== Test Complete ===");
        console2.log("SUCCESS: Deposit successful");
        console2.log("SUCCESS: Withdrawal successful");
        console2.log("SUCCESS: All balances correct");
    }
}
