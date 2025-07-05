// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Pool {
    mapping(address => uint256) public balances;
    
    event Deposited(address indexed depositor, uint256 amount);
    event Withdrawn(address indexed depositor, address indexed destination, uint256 amount);
    
    function deposit() external payable {
        require(msg.value > 0, "Must deposit some ETH");
        
        balances[msg.sender] += msg.value;
        
        emit Deposited(msg.sender, msg.value);
    }
    
    function withdraw(address destination, uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        require(destination != address(0), "Invalid destination");
        
        balances[msg.sender] -= amount;
        
        (bool success, ) = destination.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit Withdrawn(msg.sender, destination, amount);
    }
    
    function getBalance(address depositor) external view returns (uint256) {
        return balances[depositor];
    }
}
