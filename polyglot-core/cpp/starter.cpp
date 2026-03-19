#include <iostream>
#include <vector>

int main() {
  const std::string name = "Paxion";
  const std::vector<std::string> skills = {"analysis", "runtime", "automation"};

  std::cout << "Hello from C++, " << name << "." << std::endl;
  std::cout << "Skills:";
  for (const auto &skill : skills) {
    std::cout << ' ' << skill;
  }
  std::cout << std::endl;
  return 0;
}