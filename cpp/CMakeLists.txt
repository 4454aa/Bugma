cmake_minimum_required(VERSION 3.16)
project(bugma_solver_cpp LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(bugma_solver src/main.cpp)

add_executable(make_replay_save tools/make_replay_save.cpp)
