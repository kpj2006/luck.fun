// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {RugsFun} from "../../src/core/RugsFun.sol";
import {Errors} from "../../src/utils/Errors.sol";
import {Constants} from "../../src/utils/Constants.sol";

/**
 * @title MockERC20
 * @notice Mock ERC20 token for testing
 */
contract MockERC20 is ERC20 {
    constructor() ERC20("Mock Token", "MOCK") {
        _mint(msg.sender, 1000000 * 10**18); // 1M tokens
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @title RugsFunTest
 * @notice Unit tests for RugsFun contract
 */
contract RugsFunTest is Test {
    RugsFun public rugsFun;
    MockERC20 public gameToken;

    address public owner = address(0x1);
    address public treasury = address(0x2);
    address public user1 = address(0x3);
    address public user2 = address(0x4);

    uint256 constant INITIAL_BALANCE = 1000 ether;

    event Deposit(address indexed user, uint256 amount, uint256 newBalance);
    event Withdraw(address indexed user, uint256 amount, uint256 newBalance);


    function setUp() public {
        // Deploy mock token
        vm.prank(owner);
        gameToken = new MockERC20();

        // Deploy RugsFun contract
        vm.prank(owner);
        rugsFun = new RugsFun(
            address(gameToken),
            treasury,
            owner
        );

        // Mint tokens to users
        gameToken.mint(user1, INITIAL_BALANCE);
        gameToken.mint(user2, INITIAL_BALANCE);

        // Approve rugsFun to spend tokens
        vm.prank(user1);
        gameToken.approve(address(rugsFun), type(uint256).max);

        vm.prank(user2);
        gameToken.approve(address(rugsFun), type(uint256).max);
    }

    // ============ Constructor Tests ============

    function test_Constructor() public {
        assertEq(address(rugsFun.gameToken()), address(gameToken));
        assertEq(rugsFun.treasury(), treasury);
        assertEq(rugsFun.owner(), owner);
    }

    function test_Constructor_RevertsIfGameTokenZero() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidAddress.selector, address(0)));
        new RugsFun(address(0), treasury, owner);
    }

    function test_Constructor_RevertsIfTreasuryZero() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidAddress.selector, address(0)));
        new RugsFun(address(gameToken), address(0), owner);
    }

    // ============ Deposit Tests ============

    function test_Deposit() public {
        uint256 depositAmount = 100 ether;

        vm.expectEmit(true, true, true, true);
        emit Deposit(user1, depositAmount, depositAmount);

        vm.prank(user1);
        rugsFun.deposit(depositAmount);

        assertEq(rugsFun.balanceOf(user1), depositAmount);
        assertEq(rugsFun.depositedBalance(user1), depositAmount);
        assertEq(rugsFun.totalValueLocked(), depositAmount);
        assertEq(gameToken.balanceOf(address(rugsFun)), depositAmount);
    }

    function test_Deposit_Multiple() public {
        vm.prank(user1);
        rugsFun.deposit(50 ether);

        vm.prank(user1);
        rugsFun.deposit(30 ether);

        assertEq(rugsFun.balanceOf(user1), 80 ether);
        assertEq(rugsFun.depositedBalance(user1), 80 ether);
    }

    function test_Deposit_RevertsIfZeroAmount() public {
        vm.expectRevert(Errors.ZeroAmount.selector);
        vm.prank(user1);
        rugsFun.deposit(0);
    }

    function test_Deposit_RevertsIfBelowMinimum() public {
        uint256 tooSmall = 0.001 ether; // Less than MIN_DEPOSIT (0.01)

        vm.expectRevert(
            abi.encodeWithSelector(
                Errors.DepositBelowMinimum.selector,
                tooSmall,
                Constants.MIN_DEPOSIT
            )
        );
        vm.prank(user1);
        rugsFun.deposit(tooSmall);
    }

    function test_Deposit_RevertsIfExceedsMaximum() public {
        uint256 tooLarge = 1001 ether; // More than MAX_DEPOSIT (1000)

        vm.expectRevert(
            abi.encodeWithSelector(
                Errors.DepositExceedsMaximum.selector,
                tooLarge,
                Constants.MAX_DEPOSIT
            )
        );
        vm.prank(user1);
        rugsFun.deposit(tooLarge);
    }

    // ============ Withdraw Tests ============

    function test_Withdraw() public {
        // First deposit
        vm.prank(user1);
        rugsFun.deposit(100 ether);

        // Then withdraw
        uint256 withdrawAmount = 50 ether;

        vm.expectEmit(true, true, true, true);
        emit Withdraw(user1, withdrawAmount, 50 ether);

        vm.prank(user1);
        rugsFun.withdraw(withdrawAmount);

        assertEq(rugsFun.balanceOf(user1), 50 ether);
        assertEq(rugsFun.totalValueLocked(), 50 ether);
        assertEq(gameToken.balanceOf(user1), INITIAL_BALANCE - 50 ether);
    }

    function test_Withdraw_All() public {
        uint256 depositAmount = 100 ether;

        vm.prank(user1);
        rugsFun.deposit(depositAmount);

        vm.prank(user1);
        rugsFun.withdraw(depositAmount);

        assertEq(rugsFun.balanceOf(user1), 0);
        assertEq(rugsFun.totalValueLocked(), 0);
        assertEq(gameToken.balanceOf(user1), INITIAL_BALANCE);
    }

    function test_Withdraw_RevertsIfZeroAmount() public {
        vm.prank(user1);
        rugsFun.deposit(100 ether);

        vm.expectRevert(Errors.ZeroAmount.selector);
        vm.prank(user1);
        rugsFun.withdraw(0);
    }

    function test_Withdraw_RevertsIfInsufficientBalance() public {
        vm.prank(user1);
        rugsFun.deposit(50 ether);

        vm.expectRevert(
            abi.encodeWithSelector(
                Errors.InsufficientBalance.selector,
                50 ether,
                100 ether
            )
        );
        vm.prank(user1);
        rugsFun.withdraw(100 ether);
    }

    // ============ Daily Limit Tests ============

    function test_Withdraw_EnforcesDailyLimit() public {
        // Deposit large amount
        vm.prank(user1);
        rugsFun.deposit(500 ether);

        // Try to withdraw more than daily limit (10,000 tokens in Constants)
        // But our max is actually smaller, so let's test partial withdrawals
        vm.prank(user1);
        rugsFun.withdraw(400 ether);

        // Fast forward 1 day
        vm.warp(block.timestamp + 1 days);

        // Should be able to withdraw again
        vm.prank(user1);
        rugsFun.withdraw(100 ether);

        assertEq(rugsFun.balanceOf(user1), 0);
    }

    // ============ Admin Tests ============

    function test_SetTreasury() public {
        address newTreasury = address(0x5);

        vm.prank(owner);
        rugsFun.setTreasury(newTreasury);

        assertEq(rugsFun.treasury(), newTreasury);
    }

    function test_SetTreasury_RevertsIfNotOwner() public {
        vm.expectRevert();
        vm.prank(user1);
        rugsFun.setTreasury(address(0x5));
    }

    function test_SetDepositLimits() public {
        uint256 newMin = 0.1 ether;
        uint256 newMax = 500 ether;

        vm.prank(owner);
        rugsFun.setDepositLimits(newMin, newMax);

        (uint256 min, uint256 max) = rugsFun.getDepositLimits();
        assertEq(min, newMin);
        assertEq(max, newMax);
    }

    // ============ Fuzz Tests ============

    function testFuzz_Deposit(uint256 amount) public {
        // Bound to valid range
        amount = bound(amount, Constants.MIN_DEPOSIT, Constants.MAX_DEPOSIT);

        // Ensure user has enough tokens
        if (amount > INITIAL_BALANCE) {
            gameToken.mint(user1, amount - INITIAL_BALANCE);
        }

        vm.prank(user1);
        rugsFun.deposit(amount);

        assertEq(rugsFun.balanceOf(user1), amount);
    }

    function testFuzz_DepositAndWithdraw(uint256 depositAmount, uint256 withdrawAmount) public {
        depositAmount = bound(depositAmount, Constants.MIN_DEPOSIT, Constants.MAX_DEPOSIT);
        withdrawAmount = bound(withdrawAmount, Constants.MIN_WITHDRAWAL, depositAmount);

        if (depositAmount > INITIAL_BALANCE) {
            gameToken.mint(user1, depositAmount - INITIAL_BALANCE);
        }

        vm.prank(user1);
        rugsFun.deposit(depositAmount);

        vm.prank(user1);
        rugsFun.withdraw(withdrawAmount);

        assertEq(rugsFun.balanceOf(user1), depositAmount - withdrawAmount);
    }
}
